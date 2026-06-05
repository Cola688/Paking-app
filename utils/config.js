const MAP_TILE_BASE_URL = 'http://127.0.0.1/parking-map-tiles';

function fixImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('http://rustfs:9000')) {
    return url.replace('http://rustfs:9000', 'http://rustfs:19000');
  }
  return url;
}

module.exports = {
  MAP_TILE_BASE_URL,
  fixImageUrl
};
