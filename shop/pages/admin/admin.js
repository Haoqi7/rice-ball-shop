const db = wx.cloud.database();

Page({
  data: {
    isLogged: false,
    inputPwd: "",
    tempConfig: {},
    menuList: [],
    
    showDishModal: false,
    isEdit: false,
    editingDish: { name: "", intro: "", category: "主食", isOn: true },

    showPwdChangeModal: false,
    oldAdminPwdInput: "",
    newAdminPwdInput: "",
    newOrderPwdInput: ""
  },

  inputAdminPwd(e) { this.setData({ inputPwd: e.detail.value }); },

  login() {
    const config = wx.getStorageSync('sys_config');
    if (this.data.inputPwd == config.adminPwd) {
      this.setData({ 
        isLogged: true, 
        tempConfig: config 
      });
      this.loadCloudMenu();
      wx.showToast({ title: '登录成功' });
    } else {
      wx.showToast({ title: '密码错误', icon: 'none' });
      wx.vibrateLong();
    }
  },

  logout() {
    this.setData({ isLogged: false, inputPwd: "" });
  },

  updateConfigItem(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const config = this.data.tempConfig;
    config[field] = value;
    this.setData({ tempConfig: config });
    wx.setStorageSync('sys_config', config);
  },

  // --- 菜品管理 (云端版) ---

  loadCloudMenu() {
    wx.showLoading({ title: '加载菜单' });
    db.collection('menu').get().then(res => {
      wx.hideLoading();
      const list = res.data.map(item => ({ ...item, id: item._id }));
      this.setData({ menuList: list });
    });
  },

  addDish() {
    this.setData({
      showDishModal: true, isEdit: false,
      editingDish: { name: "", intro: "", category: "主食", isOn: true }
    });
  },

  editDish(e) {
    const id = e.currentTarget.dataset.id;
    const dish = this.data.menuList.find(i => i.id === id);
    this.setData({ showDishModal: true, isEdit: true, editingDish: { ...dish } });
  },

  deleteDish(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      success: (res) => {
        if(res.confirm) {
          wx.showLoading({ title: '删除中' });
          db.collection('menu').doc(id).remove().then(() => {
            wx.hideLoading();
            this.loadCloudMenu(); 
          });
        }
      }
    });
  },

  closeDishModal() {
    this.setData({ showDishModal: false });
  },

  inputDish(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['editingDish.' + field]: e.detail.value });
  },
  
  // 【修改点】增加 '炒菜'
  pickCategory(e) {
    const cats = ['主食', '炒菜', '配料', '饮品'];
    this.setData({ ['editingDish.category']: cats[e.detail.value] });
  },
  
  switchIsOn(e) {
    this.setData({ ['editingDish.isOn']: e.detail.value });
  },

  saveDish() {
    const dish = this.data.editingDish;
    wx.showLoading({ title: '保存中' });
    
    if (this.data.isEdit) {
      const { id, _id, ...updateData } = dish; 
      db.collection('menu').doc(id).update({
        data: updateData
      }).then(() => {
        wx.hideLoading();
        this.setData({ showDishModal: false });
        this.loadCloudMenu();
      });
    } else {
      db.collection('menu').add({
        data: dish
      }).then(() => {
        wx.hideLoading();
        this.setData({ showDishModal: false });
        this.loadCloudMenu();
      });
    }
  },
  
  // --- 数据清洗 ---
  clearAllOrderData() {
    wx.showModal({
      title: '危险操作',
      content: '确定要清空所有历史订单吗？(菜品和设置将保留)',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
            this.doClearOrders();
        }
      }
    });
  },

  doClearOrders() {
    wx.showLoading({ title: '清理中...' });
    
    wx.removeStorageSync('order_list'); 
    wx.removeStorageSync('my_cloud_ids'); 
    
    db.collection('orders').limit(20).get().then(res => {
      const list = res.data;
      if (list.length === 0) {
        wx.hideLoading();
        wx.showToast({ title: '已清空' });
        return;
      }
      
      const deletePromises = list.map(item => {
        return db.collection('orders').doc(item._id).remove();
      });
      
      Promise.all(deletePromises).then(() => {
        this.doClearOrders();
      }).catch(err => {
        console.error(err);
        wx.hideLoading();
      });
    });
  },

  // --- 密码管理 ---
  showForgot() {
    const config = wx.getStorageSync('sys_config');
    wx.showModal({
        title: '找回密码',
        editable: true,
        placeholderText: config.recoveryQuestion,
        success: (res) => {
            if (res.confirm && res.content === config.recoveryAnswer) {
                wx.showModal({ title: '您的密码', content: `管理: ${config.adminPwd}\n下单: ${config.orderPwd}`, showCancel: false });
            }
        }
    })
  },

  openPwdModal() {
    this.setData({ 
        showPwdChangeModal: true, 
        oldAdminPwdInput: "", newAdminPwdInput: "", newOrderPwdInput: "" 
    });
  },

  closePwdModal() { this.setData({ showPwdChangeModal: false }); },

  inputOldAdminPwd(e) { this.setData({ oldAdminPwdInput: e.detail.value }); },
  inputNewAdminPwd(e) { this.setData({ newAdminPwdInput: e.detail.value }); },
  inputNewOrderPwd(e) { this.setData({ newOrderPwdInput: e.detail.value }); },

  savePasswordChange() {
      const config = this.data.tempConfig;
      if (this.data.oldAdminPwdInput != config.adminPwd) {
          wx.showToast({ title: '旧管理密码错误', icon: 'none' });
          return;
      }
      let changed = false;
      if (this.data.newAdminPwdInput) { config.adminPwd = this.data.newAdminPwdInput; changed = true; }
      if (this.data.newOrderPwdInput) { config.orderPwd = this.data.newOrderPwdInput; changed = true; }

      if (changed) {
          wx.setStorageSync('sys_config', config);
          this.setData({ tempConfig: config }); 
          wx.showToast({ title: '修改成功' });
      }
      this.closePwdModal();
  }
})