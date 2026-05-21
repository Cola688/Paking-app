const api = require('../../utils/api.js');

const MAP_WORLD_WIDTH = 10;
const MAP_WORLD_HEIGHT = 7.07;
const MAP_DISPLAY_WIDTH = 1404;
const MAP_DISPLAY_HEIGHT = 993;

Page({
  mapImageBaseUrl: 'http://192.168.124.8:7003/app/api/v1',

  data: {
    agreement: true,
    areaMarkerScale: 2,
    areaMapTiles: [],
    areasLoading: false,
    files: [],
    form: {
      applicantName: '',
      areaAddress: '',
      areaName: '',
      phone: '',
      plateNumber: ''
    },
    mapAreaScaleMax: 2.6,
    mapAreaScaleMin: 0.5,
    mapAreaScaleValue: 0.5,
    mapAreaX: 0,
    mapAreaY: 0,
    mapAreas: [],
    region: ['', '', ''],
    selectedArea: null,
    selectedAreaId: '',
    submitting: false,
    tileCols: 6,
    tileHeight: 248.25,
    tileLoadedCount: 0,
    tileOverlap: 2,
    tileRows: 4,
    tileTotalCount: 0,
    tileWidth: 234
  },

  onLoad() {
    const app = getApp();
    if (app?.globalData?.baseUrl) {
      this.mapImageBaseUrl = app.globalData.baseUrl;
    }

    const userInfo = wx.getStorageSync('userInfo') || {};
    const username = wx.getStorageSync('username') || '';
    this.setData({
      form: {
        ...this.data.form,
        applicantName: userInfo.nickName || userInfo.nickname || '',
        phone: /^1\d{10}$/.test(username) ? username : ''
      }
    });
    this.loadMapTiles();
    this.loadMapAreas();
  },

  loadMapTiles() {
    const areaMapTiles = this.buildMapTiles();
    this.loadedTileCount = 0;
    this.tileLoadFailed = false;
    this.setData({
      areaMapTiles,
      tileLoadedCount: 0,
      tileTotalCount: areaMapTiles.length
    });
    this.downloadMapTiles(areaMapTiles);
  },

  buildMapTiles() {
    const tiles = [];
    for (let row = 0; row < this.data.tileRows; row += 1) {
      for (let col = 0; col < this.data.tileCols; col += 1) {
        tiles.push({
          col,
          height: this.data.tileHeight + (row === 0 ? 0 : this.data.tileOverlap),
          key: `${row}_${col}`,
          remoteUrl: `${this.mapImageBaseUrl}/parking/maps/local-tile/${row}/${col}?v=2026052101`,
          row,
          url: '',
          width: this.data.tileWidth + (col === 0 ? 0 : this.data.tileOverlap),
          x: col === 0 ? 0 : col * this.data.tileWidth - this.data.tileOverlap,
          y: row === 0 ? 0 : row * this.data.tileHeight - this.data.tileOverlap
        });
      }
    }
    return tiles;
  },

  async downloadMapTiles(tiles) {
    const token = wx.getStorageSync('token');
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      try {
        const filePath = await this.requestTileFile(tile, token);
        this.loadedTileCount += 1;
        this.setData({
          [`areaMapTiles[${index}].url`]: filePath,
          tileLoadedCount: this.loadedTileCount
        });
      } catch (err) {
        console.error('加载共享申请地图瓦片失败:', tile, err);
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

          const filePath = `${wx.env.USER_DATA_PATH}/share_area_tile_${tile.key}.png`;
          wx.getFileSystemManager().writeFile({
            data: res.data,
            filePath,
            success: () => resolve(filePath),
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  showTileLoadError() {
    if (this.tileLoadFailed) {
      return;
    }
    this.tileLoadFailed = true;
    wx.showToast({ title: '地图加载失败', icon: 'none' });
  },

  async loadMapAreas() {
    this.setData({ areasLoading: true });
    try {
      const res = await api.getParkingSharedAreas();
      this.setData({
        areasLoading: false,
        mapAreas: this.buildMapAreas(res?.data || [])
      });
    } catch (err) {
      console.error('加载共享申请区域失败:', err);
      this.setData({
        areasLoading: false,
        mapAreas: []
      });
    }
  },

  buildMapAreas(areas = []) {
    return (Array.isArray(areas) ? areas : []).flatMap((item, index) => {
      const center = this.resolveAreaCenter(item);
      if (!center || item.id === undefined || item.id === null) {
        return [];
      }

      const total = Math.max(this.toNumber(item.totalSpotCount) || 0, 0);
      const available = Math.max(this.toNumber(item.sharedSpotCount) || 0, 0);
      const parkingLotCount = Math.max(this.toNumber(item.parkingLotCount) || 0, 0);
      const xRatio = this.clamp(center.x / MAP_WORLD_WIDTH);
      const yRatio = this.clamp(center.y / MAP_WORLD_HEIGHT);
      const name = item.name || `共享区域${index + 1}`;
      const areaCode = `区域${index + 1}`;

      return [{
        address: parkingLotCount > 0 ? `包含${parkingLotCount}个停车场` : '暂未包含停车场',
        areaCode,
        available,
        id: String(item.id),
        name,
        rawId: '',
        sharedAreaId: String(item.id),
        shortName: this.buildShortName(areaCode, index),
        statusText: parkingLotCount > 0 ? `${parkingLotCount}个停车场` : '待完善',
        total,
        x: Math.round(xRatio * MAP_DISPLAY_WIDTH),
        y: Math.round(yRatio * MAP_DISPLAY_HEIGHT)
      }];
    });
  },

  resolveAreaCenter(area) {
    const centerX = this.toNumber(area.centerX);
    const centerY = this.toNumber(area.centerY);
    if (centerX !== null && centerY !== null) {
      return { x: centerX, y: centerY };
    }

    const points = Array.isArray(area.points) ? area.points : [];
    const validPoints = points
      .map(point => ({ x: this.toNumber(point.x), y: this.toNumber(point.y) }))
      .filter(point => point.x !== null && point.y !== null);
    if (validPoints.length === 0) {
      return null;
    }

    const total = validPoints.reduce((ret, point) => ({
      x: ret.x + point.x,
      y: ret.y + point.y
    }), { x: 0, y: 0 });
    return {
      x: total.x / validPoints.length,
      y: total.y / validPoints.length
    };
  },

  buildShortName(areaCode, index) {
    const value = String(areaCode || '').trim();
    if (!value) {
      return String(index + 1);
    }
    return value.length > 3 ? String(index + 1) : value;
  },

  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  },

  clamp(value) {
    return Math.min(Math.max(Number(value) || 0, 0), 1);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value
    });
  },

  onRegionChange(e) {
    this.setData({ region: e.detail.value || ['', '', ''] });
  },

  onAreaMapScale(e) {
    const scale = e.detail.scale || this.data.mapAreaScaleValue;
    const areaMarkerScale = Number((1 / scale).toFixed(2));
    const now = Date.now();
    if (this.lastAreaScaleUpdate && now - this.lastAreaScaleUpdate < 80 && Math.abs(areaMarkerScale - this.data.areaMarkerScale) < 0.08) {
      return;
    }
    this.lastAreaScaleUpdate = now;
    this.setData({ areaMarkerScale });
  },

  selectArea(e) {
    this.selectAreaById(String(e.currentTarget.dataset.id));
  },

  selectAreaById(id) {
    const selectedArea = this.data.mapAreas.find(item => item.id === id);
    if (!selectedArea) {
      return;
    }

    this.setData({
      'form.areaAddress': selectedArea.address || selectedArea.name,
      'form.areaName': selectedArea.name,
      selectedArea,
      selectedAreaId: selectedArea.id
    });
  },

  chooseFile() {
    const remainCount = Math.max(1, 3 - this.data.files.length);
    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = [...this.data.files, ...(res.tempFiles || [])].slice(0, 3);
        this.setData({ files });
      }
    });
  },

  removeFile(e) {
    const index = Number(e.currentTarget.dataset.index);
    const files = this.data.files.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ files });
  },

  toggleAgreement() {
    this.setData({ agreement: !this.data.agreement });
  },

  async submitApplication() {
    if (this.data.submitting) {
      return;
    }

    const form = this.data.form;
    if (!form.applicantName.trim()) {
      wx.showToast({ title: '请输入申请人姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(form.phone.trim())) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!form.plateNumber.trim()) {
      wx.showToast({ title: '请输入车牌号码', icon: 'none' });
      return;
    }
    if (!this.data.region[0]) {
      wx.showToast({ title: '请选择常住地址', icon: 'none' });
      return;
    }
    if (!this.data.selectedArea || !form.areaName) {
      wx.showToast({ title: '请选择拟申请区域', icon: 'none' });
      return;
    }
    if (this.data.files.length === 0) {
      wx.showToast({ title: '请上传证明材料', icon: 'none' });
      return;
    }
    if (!this.data.agreement) {
      wx.showToast({ title: '请先同意使用协议', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.createShareApplication(this.buildSubmitPayload());
      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    } catch (err) {
      console.error('提交共享申请失败:', err);
    } finally {
      this.setData({ submitting: false });
    }
  },

  buildSubmitPayload() {
    const form = this.data.form;
    const selectedArea = this.data.selectedArea || {};
    return {
      applicantName: form.applicantName.trim(),
      areaAddress: form.areaAddress || selectedArea.address || selectedArea.name || '',
      areaCode: selectedArea.areaCode || '',
      areaName: form.areaName,
      sharedAreaId: selectedArea.sharedAreaId,
      phone: form.phone.trim(),
      plateNumber: form.plateNumber.trim().toUpperCase(),
      proofFileNames: this.getProofFileNames(),
      regionText: this.data.region.filter(Boolean).join(' ')
    };
  },

  getProofFileNames() {
    return this.data.files.map((file, index) => {
      const path = file.name || file.path || file.tempFilePath || '';
      const parts = String(path).split('/');
      return parts[parts.length - 1] || `证明材料${index + 1}`;
    });
  },

  cancel() {
    wx.navigateBack();
  }
});
