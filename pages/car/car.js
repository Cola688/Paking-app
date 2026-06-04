const api = require('../../utils/api.js');

const PLATE_COLORS = [
  { label: '蓝牌', value: 1 },
  { label: '绿牌', value: 2 },
  { label: '黄牌', value: 3 },
  { label: '白牌', value: 4 },
  { label: '黑牌', value: 5 }
];

Page({
  data: {
    cars: [],
    loading: false,
    empty: false,

    // 表单弹窗
    showForm: false,
    formTitle: '绑定车辆',
    formId: '',
    plateNumber: '',
    plateColor: 1,
    plateColors: PLATE_COLORS,
    submitting: false,

    // 选中颜色索引（用于 UI 高亮）
    colorActiveIndex: 0
  },

  onLoad() {
    this.loadCars();
  },

  onShow() {
    this.loadCars();
  },

  /** 加载车辆列表 */
  async loadCars() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await api.getUserPlates({ pageNum: 1, pageSize: 50 });
      const records = res?.data?.records || res?.records || [];
      const cars = records.map(item => ({
        id: item.id,
        plateNumber: item.plateNumber,
        plateColor: item.plateColor,
        isDefault: item.isDefault,
        colorLabel: this.getPlateColorLabel(item.plateColor)
      }));
      this.setData({
        cars,
        empty: cars.length === 0,
        loading: false
      });
    } catch (err) {
      console.error('加载车辆失败:', err);
      this.setData({
        cars: [],
        empty: true,
        loading: false
      });
    }
  },

  /** 获取车牌颜色标签 */
  getPlateColorLabel(colorValue) {
    const found = PLATE_COLORS.find(c => c.value === colorValue);
    return found ? found.label : '蓝牌';
  },

  /** 打开添加车辆表单 */
  openAddForm() {
    this.setData({
      showForm: true,
      formTitle: '绑定车辆',
      formId: '',
      plateNumber: '',
      plateColor: 1,
      colorActiveIndex: 0,
      submitting: false
    });
  },

  /** 打开编辑车辆表单 */
  openEditForm(e) {
    const id = e.currentTarget.dataset.id;
    const car = this.data.cars.find(c => String(c.id) === String(id));
    if (!car) return;

    const colorIdx = PLATE_COLORS.findIndex(c => c.value === car.plateColor);
    this.setData({
      showForm: true,
      formTitle: '编辑车辆',
      formId: id,
      plateNumber: car.plateNumber,
      plateColor: car.plateColor,
      colorActiveIndex: colorIdx >= 0 ? colorIdx : 0,
      submitting: false
    });
  },

  /** 关闭表单 */
  closeForm() {
    this.setData({ showForm: false });
  },

  /** 阻止冒泡 */
  stopPropagation() {
    // 空函数，用于阻止弹窗关闭
  },

  /** 选择车牌颜色 */
  selectColor(e) {
    const index = e.currentTarget.dataset.index;
    const color = PLATE_COLORS[index];
    this.setData({
      plateColor: color.value,
      colorActiveIndex: index
    });
  },

  /** 车牌号输入 */
  onPlateInput(e) {
    this.setData({ plateNumber: e.detail.value });
  },

  /** 提交绑定/编辑 */
  async handleSubmit() {
    const { plateNumber, plateColor, formId } = this.data;

    // 验证
    if (!plateNumber.trim()) {
      wx.showToast({ title: '请输入车牌号', icon: 'none' });
      return;
    }

    // 车牌号格式校验
    const plateReg = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/;
    if (!plateReg.test(plateNumber.trim().toUpperCase())) {
      wx.showToast({ title: '请输入正确的车牌号', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      if (formId) {
        // 编辑
        await api.updateUserPlate(formId, {
          plateNumber: plateNumber.trim(),
          plateColor
        });
        wx.showToast({ title: '编辑成功', icon: 'success' });
      } else {
        // 添加
        await api.bindUserPlate({
          plateNumber: plateNumber.trim(),
          plateColor
        });
        wx.showToast({ title: '绑定成功', icon: 'success' });
      }

      this.setData({ showForm: false, submitting: false });
      this.loadCars();
    } catch (err) {
      console.error('操作失败:', err);
      this.setData({ submitting: false });
      wx.showToast({ title: err?.data?.msg || err?.data?.message || '操作失败', icon: 'none' });
    }
  },

  /** 解绑车辆 */
  unbindCar(e) {
    const id = e.currentTarget.dataset.id;
    const car = this.data.cars.find(c => String(c.id) === String(id));
    if (!car) return;

    wx.showModal({
      title: '确认解绑',
      content: `确定要解绑车辆 ${car.plateNumber} 吗？`,
      confirmColor: '#d33b3b',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await api.unbindUserPlate(id);
          wx.showToast({ title: '解绑成功', icon: 'success' });
          this.loadCars();
        } catch (err) {
          console.error('解绑失败:', err);
          wx.showToast({ title: err?.data?.msg || err?.data?.message || '解绑失败', icon: 'none' });
        }
      }
    });
  }
});
