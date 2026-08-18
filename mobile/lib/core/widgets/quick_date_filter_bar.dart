import 'package:flutter/material.dart';

import '../utils/formatters.dart';
import '../utils/quick_date_filter.dart';

/// Horizontal row of period chips (spec point 57) — tapping "Personnalisé"
/// opens a date-range picker; picking the same start/end day covers "une
/// date précise" from point 54.
class QuickDateFilterBar extends StatelessWidget {
  const QuickDateFilterBar({
    super.key,
    required this.selected,
    required this.customRange,
    required this.onChanged,
  });

  final QuickDateFilter selected;
  final DateTimeRange? customRange;
  final void Function(QuickDateFilter filter, DateTimeRange? customRange) onChanged;

  Future<void> _pickCustomRange(BuildContext context) async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
      initialDateRange: customRange,
    );
    if (picked != null) onChanged(QuickDateFilter.custom, picked);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          for (final f in QuickDateFilter.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(f == QuickDateFilter.custom && selected == f && customRange != null
                    ? '${formatShortDate(customRange!.start)} - ${formatShortDate(customRange!.end)}'
                    : f.label),
                selected: selected == f,
                onSelected: (_) => f == QuickDateFilter.custom ? _pickCustomRange(context) : onChanged(f, null),
              ),
            ),
        ],
      ),
    );
  }
}
