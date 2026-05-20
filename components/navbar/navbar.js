Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    showBack: {
      type: Boolean,
      value: true
    },
    showBackText: {
      type: Boolean,
      value: false
    },
    showHome: {
      type: Boolean,
      value: false
    },
    titleColor: {
      type: String,
      value: 'white'
    }
  },

  data: {
    navContentHeight: 44,
    sideWidth: 96,
    statusBarHeight: 20
  },

  lifetimes: {
    attached() {
      const systemInfo = wx.getSystemInfoSync();
      let menuButton;
      try {
        menuButton = wx.getMenuButtonBoundingClientRect();
      } catch (e) {}

      const statusBarHeight = systemInfo.statusBarHeight || 20;
      const menuGap = menuButton ? Math.max(menuButton.top - statusBarHeight, 4) : 4;
      const navContentHeight = menuButton ? menuButton.height + menuGap * 2 : 44;
      const sideWidth = menuButton ? systemInfo.windowWidth - menuButton.left : 96;

      this.setData({
        navContentHeight,
        sideWidth,
        statusBarHeight
      });
    }
  },

  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({
          fail: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    },
    onHome() {
      wx.switchTab({ url: '/pages/index/index' });
    }
  }
});
