# Source Connector Examples (workflow-based)

Consulted during Phase 3 (Source Connector) of `SKILL.md`. Full listener code for each connector
type — Phase 3 in `SKILL.md` has the conventions these examples follow (never return an error from
the `resource`/`remote` function; the listener's job ends at "durably accepted," not "durably
processed").

All three examples share this helper, defined once per project:

```ballerina
// Never called from inside workflow code — this observes a workflow from the outside.
isolated function logWorkflowOutcome(string workflowId) {
    anydata|error result = workflow:getWorkflowResult(workflowId);
    if result is error {
        log:printError("Workflow ended in error", 'error = result, workflowId = workflowId);
    }
}
```

## MLLP / HL7v2 listener

**There is no `Hl7Listener`/`Hl7Service` type in `ballerinax/health.hl7v2`** — do not assume one
exists just because typed listeners exist for HTTP and File. The real, documented primitive is a
raw `ballerina/tcp` listener with a `tcp:ConnectionService`, decoding each byte stream yourself
with `hl7v2:parse()`. Unlike the HTTP/File examples below, **there is no implicit acknowledgment at
this layer** — MLLP requires an explicit ACK/NAK written back over the same connection, so the
service constructs one using the matching version package's `ACK` type and writes it with
`caller->writeBytes()`:

```ballerina
import ballerina/log;
import ballerina/tcp;
import ballerina/workflow;
import ballerinax/health.hl7v2;
import ballerinax/health.hl7v23;

configurable int mllpPort = 2575;

service on new tcp:Listener(mllpPort) {
    remote function onConnect(tcp:Caller caller) returns tcp:ConnectionService {
        return new HL7ChannelConnectionService();
    }
}

service class HL7ChannelConnectionService {
    *tcp:ConnectionService;

    // No `|error` in the return type — see the convention above. A failure to even start the
    // workflow is caught and logged here, never returned to the caller; the ACK/NAK code below is
    // how the failure is actually communicated back to the sender.
    remote function onBytes(tcp:Caller caller, readonly & byte[] data) returns tcp:Error? {
        hl7v23:ADT_A01|error parsedMsg = hl7v2:parse(data).ensureType(hl7v23:ADT_A01);
        if parsedMsg is error {
            log:printError("Could not parse inbound HL7 message", 'error = parsedMsg);
            return; // no MSH to build a matching ACK from — connection is simply left open
        }

        // The workflow input must be `anydata` (WORKFLOW_101) — hl7v23:ADT_A01 is not, so
        // re-encode to the wire string and re-parse inside the workflow (Phase 4) rather than
        // passing the typed message itself.
        byte[]|hl7v2:HL7Error encoded = hl7v2:encode("2.3", parsedMsg);
        string|error workflowId = encoded is hl7v2:HL7Error
            ? encoded
            : workflow:run(processChannelMessage, <ChannelInput>{rawMessage: check string:fromBytes(encoded)});

        string ackCode = "AA";
        if workflowId is error {
            log:printError("Failed to start workflow for inbound HL7 message", 'error = workflowId);
            ackCode = "AE";
        } else {
            log:printInfo("Started workflow", workflowId = workflowId);
            // Ordinary service-level code, NOT inside a @workflow:Workflow function, so `start`
            // is fine here (unlike inside the workflow function itself — see Phase 4). Await the
            // result off to the side so the ACK below isn't held up by it.
            _ = start logWorkflowOutcome(workflowId);
        }

        // A failed workflow has already raised a review task (Phase 7/12) — the ACK/NAK below is
        // a transport-level acknowledgment, not a second synchronous failure signal.
        error? ackError = self.sendAck(caller, parsedMsg.msh.msh10, ackCode);
        if ackError is error {
            log:printError("Failed to send HL7 ACK", 'error = ackError);
        }
    }

    isolated function sendAck(tcp:Caller caller, string controlId, string ackCode) returns error? {
        // Field names below follow this library's <segment-abbreviation><field-number> pattern
        // (confirmed for msh9/msh10/msh12 against the base module's own samples) — confirm
        // msa1/msa2 against the live hl7v23 module reference before shipping, the same caution as
        // the review-task payload shape flagged in Phase 12.
        hl7v23:ACK ack = {
            msh: {msh9: {cm_msg1: "ACK"}, msh10: controlId, msh12: "2.3"},
            msa: {msa1: ackCode, msa2: controlId}
        };
        byte[] encoded = check hl7v2:encode("2.3", ack);
        check caller->writeBytes(encoded);
    }

    remote function onError(tcp:Error err) {
        log:printError("Error on HL7 connection", 'error = err);
    }
}
```

> **Confirm before shipping:** whether the transport adds/strips the MLLP start/end block bytes
> (`0x0B` … `0x1C 0x0D`) automatically depends on how the TCP listener is configured — a plain
> `ballerina/tcp` listener does not do this for you, so `data` and the outgoing ACK bytes may need
> that envelope stripped/added manually. Verify against the live transport configuration rather
> than assuming either way.

## HTTP source connector

Respond `202 Accepted` immediately after successfully starting the workflow; never return
`http:Accepted|error` — resolve any startup failure to a logged error and a `500`/`202` you choose
deliberately, not an unhandled `check` that lets the error escape as-is:

```ballerina
import ballerina/http;
import ballerina/log;
import ballerina/workflow;

service /api/v1 on new http:Listener(httpPort) {
    resource function post messages(http:Request request) returns http:Accepted {
        json|error payload = request.getJsonPayload();
        if payload is error {
            log:printError("Could not read inbound payload", 'error = payload);
            return http:ACCEPTED; // malformed input is still acknowledged, never surfaced as an error
        }

        string|error workflowId = workflow:run(processChannelMessage, {rawMessage: payload});
        if workflowId is error {
            log:printError("Failed to start workflow", 'error = workflowId);
            return http:ACCEPTED;
        }

        _ = start logWorkflowOutcome(workflowId);
        return http:ACCEPTED;
    }
}
```

## File Reader source connector

```ballerina
import ballerina/file;
import ballerina/io;
import ballerina/log;
import ballerina/workflow;

service "fileWatcher" on new file:Listener({path: watchDirectory, recursive: false}) {
    // No `|error` in the return type, for the same reason as the MLLP and HTTP listeners above.
    remote function onModify(file:FileEvent event) returns error? {
        string|error content = io:fileReadString(event.name);
        if content is error {
            log:printError("Could not read file", 'error = content, fileName = event.name);
            return;
        }
        // sourceMap equivalent (originalFilename etc.) travels in as input fields, not as
        // separately-set properties — see Phase 5.
        ChannelInput input = {rawMessage: content, originalFilename: event.name};
        string|error workflowId = workflow:run(processChannelMessage, input);
        if workflowId is error {
            log:printError("Failed to start workflow for file", 'error = workflowId, fileName = event.name);
            return;
        }
        _ = start logWorkflowOutcome(workflowId);
    }
}
```

In every case: **the listener starts exactly one workflow instance per inbound message, does no
orchestration itself, and never lets a workflow-side failure become a protocol-level error.** All
branching, transformation, and destination sends live in `processChannelMessage` (Phase 4
onward); all failure escalation lives in the human-review policy (Phase 7/12), not in the source
connector's response.
