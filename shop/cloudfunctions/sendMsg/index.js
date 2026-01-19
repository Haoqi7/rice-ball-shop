const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 格式化时间
function formatTime(dateInput) {
  let date = new Date(dateInput || Date.now());
  if (isNaN(date.getTime())) date = new Date();
  const offset = 8;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const bjDate = new Date(utc + (3600000 * offset));
  const Y = bjDate.getFullYear();
  const M = (bjDate.getMonth() + 1).toString().padStart(2, '0');
  const D = bjDate.getDate().toString().padStart(2, '0');
  const h = bjDate.getHours().toString().padStart(2, '0');
  const m = bjDate.getMinutes().toString().padStart(2, '0');
  const s = bjDate.getSeconds().toString().padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const type = event.type || 'to_customer'; // 'to_staff' or 'to_customer'
  const { dishName, orderTime, remark, status } = event;
  const cleanTime = formatTime(orderTime);
  const templateId = ''; 

  const msgData = {
    thing1: { value: (dishName || '新订单').substring(0, 20) }, 
    time6: { value: cleanTime },
    thing7: { value: (status || '待制作').substring(0, 20) },
    thing10: { value: (remark || '无').substring(0, 20) }
  };

  try {
    if (type === 'to_staff') {
      // --- 群发给员工 (扣次数模式) ---
      // 1. 查出所有 count > 0 的订阅者
      const subscribers = await db.collection('subscribers')
        .where({
          count: _.gt(0) // 必须有剩余次数
        })
        .get();
        
      if (subscribers.data.length === 0) return { msg: '无人订阅或次数用尽' };

      // 2. 循环发送并扣减次数
      const sendPromises = subscribers.data.map(async user => {
        try {
          await cloud.openapi.subscribeMessage.send({
            touser: user._openid, 
            page: 'pages/kitchen/kitchen', 
            lang: 'zh_CN',
            templateId: templateId,
            data: msgData
          });
          
          // 发送成功后，扣减 1 次
          await db.collection('subscribers').doc(user._id).update({
            data: { count: _.inc(-1) }
          });
          
          return { id: user._id, status: 'success' };
        } catch (err) {
          console.error('发送给员工失败:', user._openid, err);
          return { id: user._id, status: 'fail', err };
        }
      });

      return await Promise.all(sendPromises);

    } else {
      // --- 发给顾客 (不扣次数，一次性) ---
      const targetUser = event.touser || OPENID;
      return await cloud.openapi.subscribeMessage.send({
        touser: targetUser,
        page: 'pages/index/index',
        lang: 'zh_CN',
        templateId: templateId,
        data: msgData
      });
    }
  } catch (err) {
    console.error('发送总失败:', err);
    return err;
  }
}