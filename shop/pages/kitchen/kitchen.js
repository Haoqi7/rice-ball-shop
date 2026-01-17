const db = wx.cloud.database();

Page({
  data: {
    activeTab: 'pending', // pending, history
    allOrders: [],
    displayOrders: [],
    watcher: null 
  },

  onLoad() {
    this.initWatcher();
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  initWatcher() {
    const that = this;
    this.data.watcher = db.collection('orders')
      .orderBy('timestamp', 'desc')
      .limit(50) 
      .watch({
        onChange: function(snapshot) {
          const list = snapshot.docs.map(o => {
             return { ...o, id: o._id }; 
          });
          that.setData({ allOrders: list });
          that.filterOrders(); 
        },
        onError: function(err) {
          console.error('监听失败', err);
        }
      });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
    this.filterOrders();
  },

  filterOrders() {
    const { activeTab, allOrders } = this.data;
    let list = [];
    if (activeTab === 'pending') {
      list = allOrders.filter(o => o.status !== 'finished');
    } else {
      list = allOrders.filter(o => o.status === 'finished');
    }
    this.setData({ displayOrders: list });
  },

  changeStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    wx.showLoading({ title: '处理中' });
    
    // 如果是开始制作，可以顺便记录一下制作时间，这里简单更新状态
    db.collection('orders').doc(id).update({
      data: { status: status },
      success: res => {
        wx.hideLoading();
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
    wx.vibrateShort();
  },

  // 【核心修复】清空历史记录 (真实删除云端已完成数据)
  clearHistory() {
    // 1. 先检查是否有历史记录
    const finishedOrders = this.data.allOrders.filter(o => o.status === 'finished');
    if (finishedOrders.length === 0) {
      wx.showToast({ title: '暂无历史记录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: `确定要删除这 ${finishedOrders.length} 条已完成的历史记录吗？`,
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' });
          
          // 小程序端不支持 where().remove() 批量删除，必须循环 doc().remove()
          const deletePromises = finishedOrders.map(order => {
             return db.collection('orders').doc(order.id).remove();
          });

          Promise.all(deletePromises)
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '已清空' });
              // 界面会自动通过 watch 刷新，无需手动处理
            })
            .catch(err => {
              wx.hideLoading();
              console.error(err);
              wx.showToast({ title: '部分删除失败', icon: 'none' });
            });
        }
      }
    })
  }
})