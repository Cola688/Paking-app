const api = require('../../utils/api.js');

Page({
  mapImageBaseUrl: 'http://192.168.124.8:7003/app/api/v1',

  data: {
    mapWidth: 1404,
    mapHeight: 993,
    mapWorldWidth: 10,
    mapWorldHeight: 7.07,
    tileRows: 4,
    tileCols: 6,
    tileWidth: 234,
    tileHeight: 248.25,
    tileOverlap: 2,
    tiles: [],
    tileLoadedCount: 0,
    tileTotalCount: 0,
    mapX: 0,
    mapY: 90,
    scaleMin: 0.3,
    scaleMax: 2.8,
    scaleValue: 0.5,
    markerScale: 2,
    selectedId: null,
    selectedPark: null,
    markers: []
  },

  onLoad(options) {
    const app = getApp();
    if (app?.globalData?.baseUrl) {
      this.mapImageBaseUrl = app.globalData.baseUrl;
    }

    this.loadMapTiles();
    this.loadMarkers(options);
  },

  async loadMarkers(options = {}) {
    try {
      const res = await api.getParkingMapPoints();
      const markers = this.buildMarkers(res?.data || []);
      const selectedId = options.id ? String(options.id) : markers[0]?.id;
      const selectedPark = markers.find(item => item.id === selectedId) || markers[0] || null;

      this.setData({
        markers,
        selectedId: selectedPark?.id || null,
        selectedPark
      });
    } catch (err) {
      console.error('加载停车地图点位失败:', err);
      this.setData({
        markers: [],
        selectedId: null,
        selectedPark: null
      });
      wx.showToast({ title: '点位加载失败', icon: 'none' });
    }
  },

  loadMapTiles() {
    const tiles = this.buildTiles();

    this.tileLoadFailed = false;
    this.loadedTileCount = 0;
    this.setData({
      tiles,
      tileLoadedCount: 0,
      tileTotalCount: tiles.length
    });

    this.downloadTiles(tiles);
  },

  async downloadTiles(tiles) {
    const token = wx.getStorageSync('token');

    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      try {
        const filePath = await this.requestTileFile(tile, token);
        this.loadedTileCount += 1;
        this.setData({
          [`tiles[${index}].url`]: filePath,
          tileLoadedCount: this.loadedTileCount
        });
      } catch (err) {
        console.error('加载停车地图瓦片失败:', tile, err);
        this.showTileLoadError();
      }
    }
  },

  requestTileFile(tile, token) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: tile.remoteUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        header: token ? { Authorization: token } : {},
        timeout: 10000,
        success: (res) => {
          if (res.statusCode !== 200 || !res.data || !res.data.byteLength) {
            reject({ statusCode: res.statusCode, dataLength: (res.data && res.data.byteLength) || 0 });
            return;
          }

          const filePath = `${wx.env.USER_DATA_PATH}/parking_tile_${tile.key}.png`;
          wx.getFileSystemManager().writeFile({
            filePath,
            data: res.data,
            success: () => resolve(filePath),
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  buildTiles() {
    const tiles = [];
    for (let row = 0; row < this.data.tileRows; row += 1) {
      for (let col = 0; col < this.data.tileCols; col += 1) {
        tiles.push({
          key: `${row}_${col}`,
          row,
          col,
          x: col === 0 ? 0 : col * this.data.tileWidth - this.data.tileOverlap,
          y: row === 0 ? 0 : row * this.data.tileHeight - this.data.tileOverlap,
          width: this.data.tileWidth + (col === 0 ? 0 : this.data.tileOverlap),
          height: this.data.tileHeight + (row === 0 ? 0 : this.data.tileOverlap),
          remoteUrl: `${this.mapImageBaseUrl}/parking/maps/local-tile/${row}/${col}?v=202605201`,
          url: ''
        });
      }
    }
    return tiles;
  },

  buildMarkers(points = []) {
    return points.flatMap(item => {
      const mapPointX = this.toNumber(item.mapPointX);
      const mapPointY = this.toNumber(item.mapPointY);
      if (mapPointX === null || mapPointY === null) {
        return [];
      }

      const total = Math.max(this.toNumber(item.total) || 0, 0);
      const available = Math.max(this.toNumber(item.available) || 0, 0);
      const latitude = this.toNumber(item.latitude);
      const longitude = this.toNumber(item.longitude);
      const marker = {
        id: String(item.id),
        name: item.name || item.parkingAreaName || item.spotCode || '停车点位',
        address: item.address || item.locationDescription || '',
        latitude,
        longitude,
        total,
        available,
        price: this.toNumber(item.price) || 0,
        mapPointX,
        mapPointY,
        color: this.getMarkerColor(available, total)
      };
      const position = this.resolveMarkerPosition(marker);

      return [{
        ...marker,
        ...position,
        statusText: this.getStatusText(marker),
        statusClass: this.getStatusClass(marker)
      }];
    });
  },

  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  },

  getMarkerColor(available, total) {
    if (available <= 0) return '#ff4d4f';
    if (total > 0 && available / total <= 0.2) return '#fa8c16';
    return '#1677ff';
  },

  resolveMarkerPosition(item) {
    let xRatio = item.xRatio;
    let yRatio = item.yRatio;

    if (
      (xRatio === undefined || yRatio === undefined)
      && item.mapPointX !== undefined
      && item.mapPointY !== undefined
    ) {
      xRatio = Number(item.mapPointX) / this.data.mapWorldWidth;
      yRatio = Number(item.mapPointY) / this.data.mapWorldHeight;
    }

    if ((xRatio === undefined || yRatio === undefined) && item.x !== undefined && item.y !== undefined) {
      xRatio = (Number(item.x) + this.data.mapWorldWidth / 2) / this.data.mapWorldWidth;
      yRatio = (this.data.mapWorldHeight / 2 - Number(item.y)) / this.data.mapWorldHeight;
    }

    xRatio = Math.min(Math.max(Number(xRatio) || 0, 0), 1);
    yRatio = Math.min(Math.max(Number(yRatio) || 0, 0), 1);

    return {
      xRatio,
      yRatio,
      x: Math.round(xRatio * this.data.mapWidth),
      y: Math.round(yRatio * this.data.mapHeight)
    };
  },

  getStatusText(park) {
    if (park.available <= 0) return '已满';
    if (park.total > 0 && park.available / park.total <= 0.2) return '紧张';
    return '空闲';
  },

  getStatusClass(park) {
    if (park.available <= 0) return 'full';
    if (park.total > 0 && park.available / park.total <= 0.2) return 'busy';
    return 'available';
  },

  onTileError(e) {
    console.error('加载停车地图瓦片失败:', e);
    this.showTileLoadError();
  },

  showTileLoadError() {
    if (this.tileLoadFailed) {
      return;
    }
    this.tileLoadFailed = true;
    wx.showToast({ title: '地图加载失败', icon: 'none' });
  },

  onScale(e) {
    const scale = e.detail.scale || this.data.scaleValue;
    const markerScale = Number((1 / scale).toFixed(2));
    const now = Date.now();

    this.currentScale = scale;

    if (this.lastScaleUpdate && now - this.lastScaleUpdate < 80 && Math.abs(markerScale - this.data.markerScale) < 0.08) {
      return;
    }
    this.lastScaleUpdate = now;

    this.setData({
      markerScale
    });
  },

  selectMarker(e) {
    const id = String(e.currentTarget.dataset.id);
    const selectedPark = this.data.markers.find(item => item.id === id);
    if (!selectedPark) return;

    this.setData({
      selectedId: id,
      selectedPark
    });
  },

  zoomIn() {
    const currentScale = this.currentScale || this.data.scaleValue;
    const nextScale = Math.min(currentScale + 0.35, this.data.scaleMax);
    this.currentScale = nextScale;
    this.setData({
      scaleValue: nextScale,
      markerScale: Number((1 / nextScale).toFixed(2))
    });
  },

  zoomOut() {
    const currentScale = this.currentScale || this.data.scaleValue;
    const nextScale = Math.max(currentScale - 0.35, this.data.scaleMin);
    this.currentScale = nextScale;
    this.setData({
      scaleValue: nextScale,
      markerScale: Number((1 / nextScale).toFixed(2))
    });
  },

  resetMap() {
    this.currentScale = 0.5;
    this.setData({
      mapX: 0,
      mapY: 90,
      scaleValue: 0.5,
      markerScale: 2
    });
  },

  onUnload() {
    if (this.scaleSyncTimer) {
      clearTimeout(this.scaleSyncTimer);
    }
  },

  goDetail() {
    if (!this.data.selectedPark) return;
    wx.navigateTo({
      url: `/pages/parkingDetail/parkingDetail?id=${this.data.selectedPark.id}`
    });
  },

  openNavigation() {
    const park = this.data.selectedPark;
    if (!park) return;

    if (park.latitude === null || park.longitude === null) {
      wx.showToast({ title: '该点位暂无经纬度', icon: 'none' });
      return;
    }

    wx.openLocation({
      latitude: park.latitude,
      longitude: park.longitude,
      name: park.name,
      address: park.address,
      scale: 18
    });
  }
});
