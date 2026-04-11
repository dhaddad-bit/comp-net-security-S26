import { useMemo } from 'react';
import { AVAILABILITY_VIEWS, DEFAULT_GROUP_VIEW, FALLBACK_VIEW } from './calendarConstants';
import {
  getViewStatsFromBlock,
  processEvents,
  mergeAvailabilityBlocks,
  filterAvailabilityAgainstPersonalEvents
} from './calendarUtils';

export default function useHeatMapController({
  groupId,
  rawAvailabilityBlocks,
  availabilityViewByGroup,
  selectedGroupKey,
  rawEvents,
  draftEvent,
  visiblePetitions,
  setAvailabilityViewByGroup
}) {
  const selectedAvailabilityView = selectedGroupKey
    ? (availabilityViewByGroup[selectedGroupKey] || DEFAULT_GROUP_VIEW)
    : DEFAULT_GROUP_VIEW;

  const handleAvailabilityViewChange = (viewKey) => {
    if (!selectedGroupKey || !AVAILABILITY_VIEWS.includes(viewKey)) return;
    setAvailabilityViewByGroup((currentMap) => ({ ...currentMap, [selectedGroupKey]: viewKey }));
  };

  const hasMultiViewAvailability = useMemo(
    () => rawAvailabilityBlocks.some((block) => block && typeof block.views === 'object' && block.views !== null),
    [rawAvailabilityBlocks]
  );

  const effectiveAvailabilityView = hasMultiViewAvailability && AVAILABILITY_VIEWS.includes(selectedAvailabilityView)
    ? selectedAvailabilityView
    : FALLBACK_VIEW;

  const finalRawEvents = useMemo(() => {
    const events = [...rawEvents];
    if (draftEvent) {
      events.push({ ...draftEvent });
    }
    return events;
  }, [rawEvents, draftEvent]);

  const projectedAvailability = useMemo(() => {
    const rawProjectedAvailability = (groupId ? rawAvailabilityBlocks : []).map((block, idx) => {
      const { availableCount } = getViewStatsFromBlock(block, effectiveAvailabilityView);
      return {
        title: '',
        availLvl: availableCount,
        start: block.start,
        end: block.end,
        event_id: `avail-${idx}`,
        mode: 'avail'
      };
    });

    return filterAvailabilityAgainstPersonalEvents(
      rawProjectedAvailability,
      rawEvents,
      effectiveAvailabilityView
    );
  }, [groupId, rawAvailabilityBlocks, rawEvents, effectiveAvailabilityView]);

  const groupAvailability = useMemo(() => {
    const consolidatedAvailability = mergeAvailabilityBlocks(projectedAvailability);
    return consolidatedAvailability.map((event, idx) => ({ ...event, event_id: `avail-merged-${idx}` }));
  }, [projectedAvailability]);

  const { legendMaxCount, legendCounts } = useMemo(() => {
    const availabilityLegendMeta = (groupId ? rawAvailabilityBlocks : []).reduce((meta, block) => {
      const { availableCount, totalCount } = getViewStatsFromBlock(block, effectiveAvailabilityView);
      if (availableCount > meta.maxVisibleCount) meta.maxVisibleCount = availableCount;
      if (totalCount > meta.maxTotalCount) meta.maxTotalCount = totalCount;
      return meta;
    }, { maxVisibleCount: 0, maxTotalCount: 0 });

    let maxCount = availabilityLegendMeta.maxVisibleCount;
    if (availabilityLegendMeta.maxTotalCount > 0) {
      maxCount = Math.min(maxCount, availabilityLegendMeta.maxTotalCount);
    }

    return {
      legendMaxCount: maxCount,
      legendCounts: maxCount > 0 ? Array.from({ length: maxCount }, (_, idx) => idx + 1) : []
    };
  }, [groupId, rawAvailabilityBlocks, effectiveAvailabilityView]);

  const allEvents = useMemo(() => {
    const combined = processEvents(finalRawEvents)
      .concat(processEvents(groupAvailability), processEvents(visiblePetitions));

    combined.sort((a, b) => {
      if (a.start.getTime() !== b.start.getTime()) {
        return a.start.getTime() - b.start.getTime();
      }
      if (a.mode === 'avail' && b.mode !== 'avail') return -1;
      if (a.mode !== 'avail' && b.mode === 'avail') return 1;
      return 0;
    });

    let currentOverlapIndex = 0;
    for (let i = 0; i < combined.length; i += 1) {
      if (combined[i].mode === 'avail') {
        combined[i].overlapIndex = 0;
      } else {
        if (
          i > 0 &&
          combined[i].start.getTime() === combined[i - 1].start.getTime() &&
          combined[i - 1].mode !== 'avail'
        ) {
          currentOverlapIndex += 1;
        } else {
          currentOverlapIndex = 0;
        }
        combined[i].overlapIndex = currentOverlapIndex;
      }
    }

    return combined;
  }, [finalRawEvents, groupAvailability, visiblePetitions]);

  return {
    allEvents,
    effectiveAvailabilityView,
    hasMultiViewAvailability,
    legendCounts,
    legendMaxCount,
    handleAvailabilityViewChange
  };
}
