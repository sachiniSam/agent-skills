import 'package:flutter/material.dart';
void main() => runApp(const OrdersApp());
class OrdersApp extends StatelessWidget {
  const OrdersApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(home: Scaffold(appBar: AppBar(title: const Text('Orders')), body: const Center(child: Text('Sign in to see your orders.'))));
}
