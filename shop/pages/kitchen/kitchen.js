const db = wx.cloud.database();
const _ = db.command;
const TEMPLATE_ID = '';

Page({
  data: {
    activeTab: 'pending', 
    allOrders: [],
    displayOrders: [],
    watcher: null,
    
    // 通知相关
    isSubscribed: false, 
    remainCount: 0 // 剩余次数
  },

  onShow() {
    this.initWatcher();
    this.checkSubscription(); // 每次显示页面都刷新一下次数
  },

  onUnload() {
    if (this.data.watcher) { this.data.watcher.close(); }
  },

  // 1. 检查订阅状态并刷新次数
  checkSubscription() {
    // 查库：用 openid 查，因为云函数里发消息是用的 openid
    // 小程序端 where({_openid:'{openid}'}) 可以查到自己的记录
    db.collection('subscribers').where({
      _openid: '{openid}'
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({ 
          isSubscribed: true, 
          remainCount: res.data[0].count || 0 
        });
      } else {
        this.setData({ isSubscribed: false, remainCount: 0 });
      }
    });
  },

  // 2. 身份开关 (仅用于首次注册或完全关闭)
  toggleSubscribe(e) {
    if (e.detail.value) {
      this.addNotificationCount(); // 开启等于加一次
    } else {
      this.unsubscribe();
    }
  },

  // 3. 【核心】手动增加通知次数
  addNotificationCount() {
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      success: (res) => {
        if (res[TEMPLATE_ID] === 'accept') {
          wx.showLoading({ title: '充值中...' });
          this.updateCloudCount();
        } else {
          wx.showToast({ title: '需允许才能接收', icon: 'none' });
          // 如果用户关了开关，这里也要同步关掉UI
          if (!this.data.isSubscribed) this.setData({ isSubscribed: false });
        }
      },
      fail: (err) => {
        console.error(err);
        this.setData({ isSubscribed: false });
      }
    });
  },

  // 4. 更新云数据库次数 (+1)
  updateCloudCount() {
    const that = this;
    db.collection('subscribers').where({
      _openid: '{openid}'
    }).get().then(res => {
      if (res.data.length > 0) {
        // 已存在：次数 +1
        const docId = res.data[0]._id;
        db.collection('subscribers').doc(docId).update({
          data: { count: _.inc(1) }
        }).then(() => {
          that.refreshUI(true);
        });
      } else {
        // 不存在：新建记录，次数 = 1
        db.collection('subscribers').add({
          data: { 
            count: 1,
            createTime: new Date()
          }
        }).then(() => {
          that.refreshUI(true);
        });
      }
    });
  },

  refreshUI(showToast) {
    wx.hideLoading();
    if (showToast) wx.showToast({ title: '剩余次数 +1' });
    this.setData({ isSubscribed: true }); // 确保开关开启
    this.checkSubscription(); // 重新拉取最新次数
  },

  unsubscribe() {
    wx.showModal({
      title: '关闭通知',
      content: '确定清空所有剩余次数并关闭通知吗？',
      success: (res) => {
        if (res.confirm) {
          db.collection('subscribers').where({
            _openid: '{openid}'
          }).remove().then(() => {
            this.setData({ isSubscribed: false, remainCount: 0 });
            wx.showToast({ title: '已关闭' });
          });
        } else {
          this.setData({ isSubscribed: true });
        }
      }
    })
  },

  // ... (以下原有业务逻辑保持不变) ...
  initWatcher() {
    const that = this;
    this.data.watcher = db.collection('orders')
      .orderBy('timestamp', 'desc')
      .limit(50) 
      .watch({
        onChange: function(snapshot) {
          const list = snapshot.docs.map(o => { return { ...o, id: o._id }; });
          that.setData({ allOrders: list });
          that.filterOrders(); 
        },
        onError: function(err) { console.error('监听失败', err); }
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
    const targetOrder = this.data.allOrders.find(o => o.id === id);
    if (!targetOrder) return;

    wx.showLoading({ title: '处理中' });
    
    db.collection('orders').doc(id).update({
      data: { status: status },
      success: res => {
        wx.hideLoading();
        if (status === 'finished') {
           this.sendFinishNotification(targetOrder);
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
    wx.vibrateShort();
  },

  sendFinishNotification(order) {
    if (!order._openid) return;
    wx.cloud.callFunction({
      name: 'sendMsg',
      data: {
        type: 'to_customer', 
        touser: order._openid, 
        orderTime: order.timeStr,
        dishName: order.dishSummary || '美味饭团',
        remark: order.remark,
        status: '已完成'
      }
    });
  },

  clearHistory() {
    const finishedOrders = this.data.allOrders.filter(o => o.status === 'finished');
    if (finishedOrders.length === 0) return;
    wx.showModal({
      title: '确认清空',
      content: `删除 ${finishedOrders.length} 条记录？`,
      success: (res) => {
        if (res.confirm) {
          const deletePromises = finishedOrders.map(o => db.collection('orders').doc(o.id).remove());
          Promise.all(deletePromises).then(() => wx.showToast({ title: '已清空' }));
        }
      }
    })
  }
})