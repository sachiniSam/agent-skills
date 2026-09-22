import 'dotenv/config';
// An assistant that answers questions about a user's orders by calling the Orders API
// (http://localhost:4000, scopes read:orders / write:orders). It has no identity yet:
// every request below goes out unauthenticated.
async function listOrders() {
  const res = await fetch('http://localhost:4000/orders');
  return res.json();
}
console.log(await listOrders());
