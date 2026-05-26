const api = require('../../utils/api.js');

Page({
  data: {
    id: null,
    notice: null,
    loading: false
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadNotice(options.id);
  },

  async loadNotice(id) {
    if (!id) return;
    this.setData({ loading: true });

    try {
      const res = await api.getNoticeDetail(id);
      this.setData({ notice: this.normalizeNotice(res?.data || {}) });
    } catch (err) {
      console.error('加载通知详情失败:', err);
      wx.showToast({ title: '通知不存在或已失效', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  normalizeNotice(item) {
    return {
      id: item.id,
      type: item.noticeType || 'system',
      title: item.title || '通知详情',
      content: item.content || '',
      time: this.formatTime(item.publishTime || item.deliveredTime || item.createdAt),
      actionUrl: this.normalizeActionUrl(item.actionUrl || ''),
      bizType: item.bizType || item.noticeType || '',
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

    const pad = num => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  normalizeActionUrl(actionUrl) {
    if (!actionUrl) return '';
    return actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`;
  },

  goAction() {
    const notice = this.data.notice;
    if (!notice) return;

    const url = notice.actionUrl || this.resolveBusinessUrl(notice);
    if (!url || url === '/pages/notice/notice') {
      return;
    }

    this.navigateToPage(url);
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
      return '/pages/index/index';
    }

    return '';
  },

  navigateToPage(url) {
    const tabPages = ['/pages/index/index', '/pages/ai/ai', '/pages/mine/mine'];
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
  }
});
