import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/date_grouping.dart';

/// Renders a date-sorted (newest first) list grouped strictly by calendar
/// day: today's bucket is always expanded inline, every earlier day starts
/// as a single collapsed summary card ("17/08/2026 · 6 bons") that expands
/// on tap. Backed by ListView.builder throughout, so a collapsed day only
/// ever contributes one row to the widget tree — the list stays smooth
/// whether there are 30 bons or 10 000 (points 55/56/61 of the spec).
///
/// [pinnedHeader] renders above every date group (used for a "Brouillons"
/// section) and never counts toward `items`. [forceExpandAll] mirrors the
/// screen-level "afficher les anciens bons" toggle — when true every day is
/// expanded regardless of what the user tapped individually.
class DatedCollapsibleList<T> extends StatefulWidget {
  const DatedCollapsibleList({
    super.key,
    required this.items,
    required this.dateOf,
    required this.itemBuilder,
    this.pinnedHeader,
    this.forceExpandAll = false,
    this.emptyMessage = 'Aucun résultat.',
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 96),
  });

  final List<T> items;
  final DateTime Function(T) dateOf;
  final Widget Function(BuildContext, T) itemBuilder;
  final Widget? pinnedHeader;
  final bool forceExpandAll;
  final String emptyMessage;
  final EdgeInsets padding;

  @override
  State<DatedCollapsibleList<T>> createState() => _DatedCollapsibleListState<T>();
}

class _DatedCollapsibleListState<T> extends State<DatedCollapsibleList<T>> {
  final Set<DateTime> _expandedDays = {};

  @override
  Widget build(BuildContext context) {
    final groups = groupByCalendarDay(widget.items, widget.dateOf);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final rows = <Widget>[];
    if (widget.pinnedHeader != null) rows.add(widget.pinnedHeader!);

    var printedPreviousLabel = false;
    for (final entry in groups) {
      final day = entry.key;
      final dayItems = entry.value;

      if (day == today) {
        rows.add(_sectionLabel(context, "Aujourd'hui"));
        rows.addAll(dayItems.map((item) => widget.itemBuilder(context, item)));
        continue;
      }

      if (!printedPreviousLabel) {
        rows.add(_sectionLabel(context, 'Jours précédents'));
        printedPreviousLabel = true;
      }

      final expanded = widget.forceExpandAll || _expandedDays.contains(day);
      if (!expanded) {
        rows.add(_dayCollapsedCard(day, dayItems.length, () => setState(() => _expandedDays.add(day))));
      } else {
        rows.add(_dayExpandedHeader(context, day, dayItems.length, () => setState(() => _expandedDays.remove(day))));
        rows.addAll(dayItems.map((item) => widget.itemBuilder(context, item)));
      }
    }

    if (groups.isEmpty && widget.pinnedHeader != null) {
      rows.add(Padding(padding: const EdgeInsets.symmetric(vertical: 24), child: Center(child: Text(widget.emptyMessage, textAlign: TextAlign.center))));
    }

    if (rows.isEmpty) {
      return LayoutBuilder(
        builder: (context, constraints) => ListView(
          children: [
            SizedBox(height: constraints.maxHeight, child: Center(child: Text(widget.emptyMessage, textAlign: TextAlign.center))),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: widget.padding,
      itemCount: rows.length,
      itemBuilder: (context, i) => rows[i],
    );
  }

  Widget _sectionLabel(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold, color: Colors.grey[700])),
      );

  Widget _dayCollapsedCard(DateTime day, int count, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.calendar_today_outlined, color: AppTheme.primary),
        title: Text(dayLabel(day), style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('$count bon${count == 1 ? '' : 's'}'),
        trailing: const Icon(Icons.expand_more),
        onTap: onTap,
      ),
    );
  }

  Widget _dayExpandedHeader(BuildContext context, DateTime day, int count, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${dayLabel(day)} · $count bon${count == 1 ? '' : 's'}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold, color: Colors.grey[700]),
              ),
            ),
            const Icon(Icons.expand_less, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
