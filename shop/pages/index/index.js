Page({
  data: {
    config: {}
  },

  onShow() {
    // 每次显示时重新读取配置，确保修改后生效
    const config = wx.getStorageSync('sys_config') || {};
    this.setData({ config });
    
    // 设置导航栏标题
    if (config.shopName) {
      wx.setNavigationBarTitle({ title: config.shopName });
    }
  },

  navToOrder() {
    wx.vibrateShort();
    wx.navigateTo({ url: '/pages/order/order' });
  },

  navToKitchen() {
    wx.vibrateShort();
    wx.navigateTo({ url: '/pages/kitchen/kitchen' });
  },

  navToAdmin() {
    wx.vibrateShort();
    wx.navigateTo({ url: '/pages/admin/admin' });
  }
})