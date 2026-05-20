Page({
  data: {
    cars: [
      { id: 1, plateNumber: '沪A12345', type: '小型车' }
    ]
  },
  addCar() {
    wx.showToast({ title: '请手动添加车辆信息', icon: 'none' });
  },
  editCar(e) {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' });
  }
});
