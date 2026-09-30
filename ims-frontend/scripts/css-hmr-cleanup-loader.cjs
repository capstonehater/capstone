// Next 16.2.1's bundled CSS hot-reloader assumes the old link is still attached
// when the replacement finishes loading. Navigation or another refresh may
// already have removed it. Make that cleanup safe to repeat (development only).
module.exports = function cssHmrCleanupLoader(source) {
  return source.replaceAll('e.parentNode.removeChild(e)', 'e.remove()');
};
