const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

function getAmapKey() {
  try {
    const app = getApp();
    return app?.globalData?.amapWebServiceKey || '';
  } catch (e) {
    return '';
  }
}

function requestAmap(path, data = {}) {
  const key = getAmapKey();
  if (!key) {
    return Promise.reject({ message: '未配置高德地图Key' });
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${AMAP_BASE_URL}${path}`,
      method: 'GET',
      data: {
        key,
        ...data
      },
      success(res) {
        const body = res.data || {};
        if (body.status === '1') {
          resolve(body);
          return;
        }

        reject({
          code: body.infocode,
          message: body.info || '高德地图请求失败'
        });
      },
      fail: reject
    });
  });
}

function regeo(latitude, longitude) {
  return requestAmap('/geocode/regeo', {
    extensions: 'base',
    location: `${longitude},${latitude}`,
    output: 'json',
    radius: 1000
  });
}

function searchAround(latitude, longitude, keywords = '停车场', radius = 3000) {
  return requestAmap('/place/around', {
    extensions: 'base',
    keywords,
    location: `${longitude},${latitude}`,
    offset: 20,
    output: 'json',
    radius,
    sortrule: 'distance'
  });
}

module.exports = {
  regeo,
  searchAround
};
