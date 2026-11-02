import { highlightSegments } from '../../utils/helpSearch';

/** Renders text with the search terms marked. */
export default function Highlight({ text, query }) {
  return highlightSegments(text, query).map((segment, index) => (segment.match
    ? <mark key={index} className="rounded-sm bg-success-50 px-0.5 font-semibold text-success">{segment.text}</mark>
    : <span key={index}>{segment.text}</span>));
}
