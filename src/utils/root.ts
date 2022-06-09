import path from 'path';

export default (() => {
  return path.dirname(require.main?.filename!);
})();
