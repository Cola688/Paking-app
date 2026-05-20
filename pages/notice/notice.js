const api = require('../../utils/api.js');

Page({
  data: {
    notices: [],
    loading: false
  },

  onLoad() {
    this.loadNotices();
  },

  onShow() {
    this.loadNotices();
  },

  async loadNotices() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await api.getNotices({ pageNum: 1, pageSize: 50 });
      const records = res?.data?.records || [];
      this.setData({
        notices: records.map(item => this.normalizeNotice(item))
      });
    } catch (err) {
      console.error('加载通知失败:', err);
      this.setData({ notices: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  normalizeNotice(item) {
    return {
      id: item.id,
      receiverId: item.receiverId,
      type: item.noticeType || 'system',
      title: item.title || '通知',
      content: item.content || '',
      time: this.formatTime(item.publishTime || item.deliveredTime || item.createdAt),
      read: item.readFlag === 1,
      actionType: item.actionType || 'none',
      actionUrl: item.actionUrl || '',
      bizType: item.bizType || '',
      bizId: item.bizId
    };
  },

  formatTime(value) {
    if (!value) return '';

    const normalized = String(value).replace(/-/g, '/');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 16);
    }

    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
    const pad = num => String(num).padStart(2, '0');
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (sameDay) {
      return `今天 ${time}`;
    }
    if (date.getFullYear() === now.getFullYear()) {
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
    }
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
  },

  async onNoticeTap(e) {
    const { id, index } = e.currentTarget.dataset;
    const notices = [...this.data.notices];
    const currentNotice = notices[index];

    try {
      const res = await api.getNoticeDetail(id);
      const detail = res?.data ? this.normalizeNotice(res.data) : currentNotice;

      if (notices[index]) {
        notices[index] = {
          ...notices[index],
          ...detail,
          read: true
        };
        this.setData({ notices });
      }

      this.handleNoticeAction(detail);
    } catch (err) {
      console.error('读取通知失败:', err);
    }
  },

  handleNoticeAction(notice) {
    const actionUrl = this.normalizeActionUrl(notice.actionUrl || '');

    if (actionUrl && actionUrl !== '/pages/notice/notice') {
      this.navigateToPage(actionUrl);
      return;
    }

    const businessUrl = this.resolveBusinessUrl(notice);
    if (businessUrl) {
      this.navigateToPage(businessUrl);
      return;
    }

    wx.navigateTo({ url: `/pages/noticeDetail/noticeDetail?id=${notice.id}` });
  },

  normalizeActionUrl(actionUrl) {
    if (!actionUrl) return '';
    return actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`;
  },

  resolveBusinessUrl(notice) {
    const bizType = notice.bizType || notice.type;
    const bizId = notice.bizId ? encodeURIComponent(notice.bizId) : '';

    if (['promo', 'coupon'].includes(bizType)) {
      return '/pages/coupon/coupon';
    }
    if (['order', 'refund', 'payment'].includes(bizType)) {
      return bizId ? `/pages/record/record?id=${bizId}` : '/pages/record/record';
    }
    if (['parking_lot', 'parking'].includes(bizType) && bizId) {
      return `/pages/parkingDetail/parkingDetail?id=${bizId}`;
    }
    if (['package', 'product', 'monthly_product', 'parking_product', 'pass'].includes(bizType)) {
      return bizId ? `/pages/package/detail?id=${bizId}` : '/pages/package/list';
    }

    return '';
  },

  navigateToPage(url) {
    const tabPages = ['/pages/index/index', '/pages/search/search', '/pages/mine/mine'];
    const path = url.split('?')[0];

    if (tabPages.includes(path)) {
      wx.switchTab({ url: path });
      return;
    }

    wx.navigateTo({
      url,
      fail: () => {
        wx.showToast({ title: '相关页面暂未开放', icon: 'none' });
      }
    });
  },

  clearAll() {
    wx.showModal({
      title: '清空通知',
      content: '确定要清空所有通知吗？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await api.clearNotices();
          this.setData({ notices: [] });
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        } catch (err) {
          console.error('清空通知失败:', err);
        }
      }
    });
  }
});
