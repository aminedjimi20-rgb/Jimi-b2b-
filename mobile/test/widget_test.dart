import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jimi_b2b/app.dart';

void main() {
  testWidgets('App shows the login screen when logged out', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: JimiApp()));
    await tester.pump();

    expect(find.text('JIMI B2B'), findsOneWidget);
  });
}
