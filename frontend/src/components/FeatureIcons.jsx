/*
File: FeatureIcons.jsx
Purpose: Inline-SVG icon components for the three core homepage features
         (Import Calendars, Create Groups, Petition a Time).
Creation Date: 2026-05-19
Initial Author(s): David Haddad

System Context:
These are pure presentational components used by `Login.jsx` to visually anchor
each feature column. They take no props that affect logic — only `className` and
`title` for styling and accessibility. Colors follow the standard Google palette
(#4285F4, #DB4437, #F4B400, #0F9D58) to align with the OAuth consent screen.
*/

import React from 'react';

const COLORS = {
  blue:   '#4285F4',
  red:    '#DB4437',
  yellow: '#F4B400',
  green:  '#0F9D58',
  ink:    '#1f2937',
};

/**
 * Calendar-with-download-arrow icon for the "Import Your Google Calendars" feature.
 *
 * @param {{ className?: string, title?: string }} props
 * @returns {JSX.Element}
 */
export function ImportCalendarIcon({ className, title = 'Import calendars' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Calendar body */}
      <rect x="10" y="22" width="60" height="50" rx="6"
            fill="#ffffff" stroke={COLORS.blue} strokeWidth="3" />
      {/* Header band */}
      <path d="M10 32 v-4 a6 6 0 0 1 6 -6 h48 a6 6 0 0 1 6 6 v4 z" fill={COLORS.blue} />
      {/* Binding rings */}
      <rect x="22" y="14" width="4" height="14" rx="2" fill={COLORS.red} />
      <rect x="54" y="14" width="4" height="14" rx="2" fill={COLORS.red} />
      {/* Date dots */}
      <circle cx="22" cy="48" r="3" fill={COLORS.ink} />
      <circle cx="34" cy="48" r="3" fill={COLORS.ink} />
      <circle cx="46" cy="48" r="3" fill={COLORS.yellow} />
      <circle cx="58" cy="48" r="3" fill={COLORS.ink} />
      <circle cx="22" cy="60" r="3" fill={COLORS.ink} />
      <circle cx="34" cy="60" r="3" fill={COLORS.green} />
      <circle cx="46" cy="60" r="3" fill={COLORS.ink} />
      <circle cx="58" cy="60" r="3" fill={COLORS.ink} />
      {/* Download arrow pointing into the calendar */}
      <g stroke={COLORS.red} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="40" y1="2" x2="40" y2="16" />
        <polyline points="33,10 40,17 47,10" />
      </g>
    </svg>
  );
}

/**
 * Three overlapping avatars with a "+" badge for the "Create Groups" feature.
 *
 * @param {{ className?: string, title?: string }} props
 * @returns {JSX.Element}
 */
export function CreateGroupsIcon({ className, title = 'Create groups' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Back avatar (blue) */}
      <circle cx="22" cy="32" r="9" fill={COLORS.blue} />
      <path d="M8 60 a14 14 0 0 1 28 0 v4 H8z" fill={COLORS.blue} />
      {/* Right avatar (green) */}
      <circle cx="58" cy="32" r="9" fill={COLORS.green} />
      <path d="M44 60 a14 14 0 0 1 28 0 v4 H44z" fill={COLORS.green} />
      {/* Front avatar (red) */}
      <circle cx="40" cy="28" r="11" fill={COLORS.red} stroke="#ffffff" strokeWidth="2.5" />
      <path d="M22 60 a18 18 0 0 1 36 0 v4 H22z" fill={COLORS.red} stroke="#ffffff" strokeWidth="2.5" />
      {/* Add badge */}
      <circle cx="62" cy="18" r="9" fill={COLORS.yellow} stroke="#ffffff" strokeWidth="2" />
      <g stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round">
        <line x1="62" y1="13" x2="62" y2="23" />
        <line x1="57" y1="18" x2="67" y2="18" />
      </g>
    </svg>
  );
}

/**
 * Clock with a checkmark badge for the "Petition a Time" feature.
 *
 * @param {{ className?: string, title?: string }} props
 * @returns {JSX.Element}
 */
export function PetitionTimeIcon({ className, title = 'Petition a time' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Clock face */}
      <circle cx="36" cy="40" r="28" fill="#ffffff" stroke={COLORS.blue} strokeWidth="3" />
      {/* Hour ticks */}
      <g stroke={COLORS.ink} strokeWidth="2" strokeLinecap="round">
        <line x1="36" y1="14" x2="36" y2="18" />
        <line x1="36" y1="62" x2="36" y2="66" />
        <line x1="10" y1="40" x2="14" y2="40" />
        <line x1="58" y1="40" x2="62" y2="40" />
      </g>
      {/* Hour dots in accent colors */}
      <circle cx="52" cy="22" r="1.8" fill={COLORS.yellow} />
      <circle cx="20" cy="22" r="1.8" fill={COLORS.yellow} />
      <circle cx="52" cy="58" r="1.8" fill={COLORS.yellow} />
      <circle cx="20" cy="58" r="1.8" fill={COLORS.yellow} />
      {/* Clock hands */}
      <g stroke={COLORS.red} strokeWidth="3" strokeLinecap="round">
        <line x1="36" y1="40" x2="36" y2="24" />
        <line x1="36" y1="40" x2="50" y2="44" />
      </g>
      {/* Center pivot */}
      <circle cx="36" cy="40" r="2.5" fill={COLORS.ink} />
      {/* Checkmark badge (the "accepted petition") */}
      <circle cx="62" cy="62" r="11" fill={COLORS.green} stroke="#ffffff" strokeWidth="2.5" />
      <polyline points="56,62 60,66 68,57"
                fill="none" stroke="#ffffff" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
