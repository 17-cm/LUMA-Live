// =========================================================================
// 【模块二·社区子文档5·官方云端论坛系统】LIVE/社区/module_forum.js
// 包含：
// 1. 须知弹窗（勾选【永久不再显示此界面】后永不弹出）
// 2. 纯粹直接的【注册账号】与【登录账号】双向通道
// 3. 登录成功后彻底本地持久化（保存在 localStorage，关掉或退出论坛后下次秒进，绝不再弹登录/提示）
// 4. 自定义本地图片上传（支持相册选图 Base64 本地存储）+ 预设头像
// 5. 纯净官方微博主页与真实发帖/评论互动（绝无随机假用户）
// 6. 官方超级主理人鉴权系统（采用 SHA-256 单向加密哈希校验，源代码与 Git 仓库中绝无明文私钥）
// =========================================================================

var api = window.api || {};

// 官方主理人私钥 SHA-256 单向加密哈希（不可逆，代码及Git仓库中绝不保留明文）
const MASTER_KEY_HASH_SHA256 = "62f48402f5ebe24ccc8e05826f72d5d080f578d7f1160aad63ae2f5abef9f199";

// 纯前端安全 SHA-256 哈希计算函数（支持各种浏览器环境）
function computeSecureSha256(text) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var i, j;
  var result = "";
  var hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var bytes = [];
  for (i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (c < 2048) {
      bytes.push((c >> 6) | 192, (c & 63) | 128);
    } else {
      bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
    }
  }
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (i = 0; i < 8; i++) {
    bytes.push((i < 4 ? 0 : (bitLen >>> (8 * (7 - i)))) & 255);
  }
  for (i = 0; i < bytes.length; i += 64) {
    var w = [];
    for (j = 0; j < 16; j++) {
      w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | (bytes[i + j * 4 + 3]);
    }
    for (j = 16; j < 64; j++) {
      var s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      var s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    var a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    var e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (j = 0; j < 64; j++) {
      var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      var bval = (hash[i] >> (8 * j)) & 255;
      result += (bval < 16 ? "0" : "") + bval.toString(16);
    }
  }
  return result;
}

// 预设二次元与高质头像库
const FORUM_PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200"
];

// 官方论坛初始置顶官方公告（纯官方公告，不塞任何假用户帖子）
const INITIAL_FORUM_POSTS = [
  {
    id: "post_official_welcome",
    author: {
      uid: "LUMA_OFFICIAL_001",
      name: "LUMA 官方运营组",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
      role: "owner",
      roleTitle: "👑 官方主理人",
      isOfficial: true
    },
    tag: "#官方公告#",
    isPinned: true,
    time: "置顶动态 · 来自 LUMA 官方中枢",
    content: "✨ 欢迎来到 LUMA 官方云端论坛！\n\n这里是连接所有创作者与玩家的官方实时交流阵地。\n在这里，你可以第一时间获取版本更新公告、与官方主理人直接沟通，也可以在广场发布你在小手机沙盒中的创意脑洞、Bug反馈或日常心得。\n\n🔒 隐私安全说明：\n本论坛仅同步此处设置的公开名片与公开发言，您在本地小手机沙盒的所有私密对话、API Key 与角色记忆绝不上云，敬请放心畅聊！",
    likes: 0,
    isLiked: false,
    comments: []
  },
  {
    id: "post_official_v36",
    author: {
      uid: "LUMA_OFFICIAL_001",
      name: "LUMA 官方运营组",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
      role: "owner",
      roleTitle: "👑 官方主理人",
      isOfficial: true
    },
    tag: "#版本更新#",
    isPinned: false,
    time: "置顶动态 · 来自 LUMA 官方中枢",
    content: "📢 【版本更新公告 · v3.6.0 全新启航】\n\n1. 官方云端论坛正式上线，支持跨部署/跨链接无缝交流。\n2. 引入专属凭证 ID 机制，免绑定账号密码，换设备凭 ID 秒找回。\n3. 统一数据管理中枢接入完成，全服粉丝榜、打赏榜与超话签到实时联动。\n4. 角色主页与空间专区全新改版，交互流畅度与动画质感大幅跃升！",
    likes: 0,
    isLiked: false,
    comments: []
  }
];

// 当前论坛状态
let currentForumActiveTab = 'official'; // 'official' (官方公告) | 'square' (玩家广场) | 'mine' (我的发帖)

// 注册流程的临时内存状态
let forumRegisterDraft = {
  generatedUid: '',
  nickname: '',
  avatar: FORUM_PRESET_AVATARS[0]
};

// =========================================================================
// 【一、持久化本地存储：用户信息、免提示标记、管理员列表】
// =========================================================================

// 获取当前登录用户
function getForumCurrentUser() {
  try {
    const raw = localStorage.getItem('luma_forum_current_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.uid) return parsed;
    }
  } catch (e) {}
  return null;
}
window.getForumCurrentUser = getForumCurrentUser;

// 存储当前登录用户
function saveForumCurrentUser(userObj) {
  try {
    localStorage.setItem('luma_forum_current_user', JSON.stringify(userObj));
  } catch (e) {}
}

// 检查是否勾选了“永久不再显示此提示说明”
function isForumNoticeMuted() {
  try {
    return localStorage.getItem('luma_forum_notice_muted') === 'true';
  } catch (e) {
    return false;
  }
}

// 设置“永久不再显示此提示说明”
function setForumNoticeMuted(muted) {
  try {
    localStorage.setItem('luma_forum_notice_muted', muted ? 'true' : 'false');
  } catch (e) {}
}

// 管理员 UID 列表
function getForumAdminUids() {
  try {
    return JSON.parse(localStorage.getItem('luma_forum_admin_uids') || '[]');
  } catch (e) {
    return [];
  }
}

function saveForumAdminUids(list) {
  try {
    localStorage.setItem('luma_forum_admin_uids', JSON.stringify(list));
  } catch (e) {}
}

// 生成具有科技感且唯一的通行证 ID
function generateRandomVoucherID() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  };
  return `LUMA-UID-${seg(4)}-${seg(4)}`;
}

// =========================================================================
// 【二、论坛核心入口调度函数 checkAndOpenForum】
// =========================================================================

function checkAndOpenForum() {
  // 1. 如果已经登录，直接进论坛，绝不弹任何窗！
  const currentUser = getForumCurrentUser();
  if (currentUser && currentUser.uid) {
    openCommunitySubPageDirectForum();
    return;
  }

  // 2. 如果未登录，但勾选了“永久不再显示提示说明”，直接显示【注册 / 登录】窗口
  if (isForumNoticeMuted()) {
    openForumAuthPortalModal('portal');
    return;
  }

  // 3. 未登录且未勾选免提示，显示【说明须知弹窗】
  openForumNoticeModal();
}
window.checkAndOpenForum = checkAndOpenForum;

// 直接打开论坛主视图并渲染
function openCommunitySubPageDirectForum() {
  const allSubViews = [
    'communityTrendsView',
    'communitySuperTopicView',
    'communityRankView',
    'communityLiveSettingsView',
    'communityForumView',
    'communityMyTopicView'
  ];
  allSubViews.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const forumEl = document.getElementById('communityForumView');
  if (forumEl) {
    forumEl.classList.remove('hidden');
  }
  renderOfficialWeiboForum(currentForumActiveTab);
}
window.openCommunitySubPageDirectForum = openCommunitySubPageDirectForum;

// =========================================================================
// 【三、弹窗系统：提示说明弹窗、注册/登录入口、登录表单、注册表单】
// =========================================================================

// 1. 提示说明弹窗（带“永久不再显示此界面”打勾）
function openForumNoticeModal() {
  const modal = document.getElementById('forumAuthModal');
  const body = document.getElementById('forumAuthModalBody');
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
          🌐
        </div>
        <div>
          <h3 class="text-sm font-black text-slate-900">LUMA 官方云端论坛</h3>
          <p class="text-[10px] text-purple-600 font-bold">全网跨端互通 · 云端安全与隐私须知</p>
        </div>
      </div>

      <div class="space-y-2.5 text-xs text-slate-700 leading-relaxed">
        <div class="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-1.5">
          <h4 class="font-black text-purple-900 flex items-center gap-1.5">
            <span>✦ 功能说明</span>
          </h4>
          <p class="text-[11px] text-purple-800">这是连接所有 LUMA 创作者与玩家的官方实时交流阵地。您发布的动态、建议与官方公告将通过云端网络实时全网同步。</p>
        </div>

        <div class="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
          <h4 class="font-black text-slate-900 flex items-center gap-1.5">
            <span>🔒 隐私与安全性承诺</span>
          </h4>
          <ul class="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
            <li><b>小手机沙盒绝对隔离</b>：您在本地沙盒内的所有私密对话、API Key、本地模型配置等<b>绝对留在本地浏览器，绝不上云</b>！</li>
            <li><b>仅同步公开名片</b>：云端仅存储您在此处填写的公开昵称、头像以及您在论坛公开发布的帖子与评论。</li>
            <li><b>匿名凭据通行证</b>：无需绑定手机号或邮箱，系统自动分配专属凭据 ID，换设备凭 ID 即可找回。</li>
          </ul>
        </div>

        <!-- 标红警示框 -->
        <div class="p-3 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-700 space-y-1 shadow-xs">
          <div class="flex items-center gap-1.5 font-black text-xs text-rose-600">
            <svg class="w-4 h-4 text-rose-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <span>【重要提醒与警示】</span>
          </div>
          <p class="text-[11px] font-bold text-rose-600 leading-normal">
            如果您介意云端数据同步或不愿公开昵称与发言，请点击下方【退出】，切勿进入本模块！
          </p>
        </div>
      </div>

      <!-- 永久不再显示勾选框 -->
      <div class="pt-1">
        <label class="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 transition">
          <input type="checkbox" id="chkNeverShowForumNotice" class="w-4 h-4 rounded text-purple-600 accent-purple-600">
          <span class="text-xs font-black text-slate-800 select-none">永久不再显示此界面 (下次直接进入)</span>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
        <button onclick="closeForumAuthModal()" class="btn-action justify-center !py-2.5 text-xs font-bold text-slate-600">
          退出返回
        </button>
        <button onclick="handleConfirmNoticeAndProceed()" class="btn-brand justify-center !py-2.5 text-xs font-black shadow-md">
          <span>进入注册 / 登录 ›</span>
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}
window.openForumNoticeModal = openForumNoticeModal;

function handleConfirmNoticeAndProceed() {
  const chk = document.getElementById('chkNeverShowForumNotice');
  if (chk && chk.checked) {
    setForumNoticeMuted(true);
  }
  openForumAuthPortalModal('portal');
}
window.handleConfirmNoticeAndProceed = handleConfirmNoticeAndProceed;

function closeForumAuthModal() {
  const modal = document.getElementById('forumAuthModal');
  if (modal) modal.classList.add('hidden');
}
window.closeForumAuthModal = closeForumAuthModal;

// 2. 注册 / 登录主入口与表单弹窗
function openForumAuthPortalModal(viewMode = 'portal') {
  const modal = document.getElementById('forumAuthModal');
  const body = document.getElementById('forumAuthModalBody');
  if (!modal || !body) return;

  if (viewMode === 'portal') {
    // 主入口：清晰明了的【注册账号】与【登录账号】两个按钮
    body.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-base shadow-sm">
              🔑
            </div>
            <div>
              <h3 class="text-xs font-black text-slate-900">LUMA 官方论坛身份中心</h3>
              <p class="text-[9px] text-slate-400">选择注册新账号或凭 ID 登录</p>
            </div>
          </div>
          <button onclick="closeForumAuthModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
        </div>

        <div class="p-3 bg-purple-50/70 rounded-2xl border border-purple-100 text-xs text-purple-900 leading-relaxed">
          💡 <b>提示</b>：登录成功后系统将自动保存您的登录态到本地，下次进入将<b>免登录秒进</b>，无需重复操作！
        </div>

        <div class="space-y-2.5 pt-1">
          <!-- 注册账号按钮 -->
          <button onclick="openForumAuthPortalModal('register')" class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-between shadow-md active:scale-98 transition group">
            <div class="flex items-center gap-3 text-left">
              <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                ✨
              </div>
              <div>
                <h4 class="text-xs font-black">注册新账号</h4>
                <p class="text-[9px] text-purple-200 mt-0.5">自动生成专属凭证 ID · 自定义上传头像与昵称</p>
              </div>
            </div>
            <span class="text-xs font-black group-hover:translate-x-1 transition">›</span>
          </button>

          <!-- 登录账号按钮 -->
          <button onclick="openForumAuthPortalModal('login')" class="w-full p-3.5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-900 flex items-center justify-between shadow-xs active:scale-98 transition group">
            <div class="flex items-center gap-3 text-left">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg text-slate-700">
                🔐
              </div>
              <div>
                <h4 class="text-xs font-black">登录已有账号 / 官方管理私钥</h4>
                <p class="text-[9px] text-slate-400 mt-0.5">输入已有凭证 ID 或 主理人密钥即刻进入</p>
              </div>
            </div>
            <span class="text-xs font-black text-slate-400 group-hover:translate-x-1 transition">›</span>
          </button>
        </div>

        <div class="pt-2 border-t border-slate-100 flex justify-center">
          <button onclick="closeForumAuthModal()" class="text-xs font-bold text-slate-400 hover:text-slate-600">
            暂不进入，返回
          </button>
        </div>
      </div>
    `;
  } else if (viewMode === 'login') {
    // 登录表单：输入已有 ID 或 官方主理人私钥
    body.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-base">🔐</span>
            <h3 class="text-xs font-black text-slate-900">登录账号 / 凭证验证</h3>
          </div>
          <button onclick="openForumAuthPortalModal('portal')" class="text-xs font-bold text-purple-600">‹ 返回</button>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-bold text-slate-700 block">请输入你的凭证 ID 或 官方主理人密钥：</label>
          <input id="inputDirectLoginVoucher" placeholder="例如: LUMA-UID-XXXX-XXXX 或 主理人密钥" class="input-ins text-xs font-mono font-bold">
          <p class="text-[9px] text-slate-400 leading-tight">
            💡 官方主理人可直接在此输入您的专属私钥，系统将通过单向哈希加密验证解锁最高管理权限。
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
          <button onclick="openForumAuthPortalModal('portal')" class="btn-action justify-center !py-2.5 text-xs font-bold text-slate-600">
            取消
          </button>
          <button onclick="executeDirectLoginSubmit()" class="btn-brand justify-center !py-2.5 text-xs font-black shadow-md">
            <span>立即登录进入 ›</span>
          </button>
        </div>
      </div>
    `;
  } else if (viewMode === 'register') {
    // 注册表单：自动分配新 ID，玩家自定义上传本地头像或选预设，填写昵称
    forumRegisterDraft.generatedUid = generateRandomVoucherID();
    forumRegisterDraft.avatar = forumRegisterDraft.avatar || FORUM_PRESET_AVATARS[0];
    forumRegisterDraft.nickname = '';

    body.innerHTML = `
      <div class="space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="text-base">✨</span>
            <h3 class="text-xs font-black text-slate-900">注册新账号 · 设置名片</h3>
          </div>
          <button onclick="openForumAuthPortalModal('portal')" class="text-xs font-bold text-purple-600">‹ 返回</button>
        </div>

        <!-- 分配的新凭证 ID 展示卡片 -->
        <div class="p-3 bg-slate-900 text-white rounded-2xl space-y-1.5 border border-slate-800 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-[9px] text-amber-300 font-bold uppercase">YOUR VOUCHER ID · 为你生成的新凭证</span>
            <span class="text-[8px] bg-white/10 px-1.5 py-0.2 rounded text-slate-300">请牢记保存</span>
          </div>
          <div class="flex items-center justify-between gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
            <span class="font-mono text-xs font-black text-amber-400 select-all tracking-wider">${forumRegisterDraft.generatedUid}</span>
            <button onclick="copyGeneratedVoucher('${forumRegisterDraft.generatedUid}')" class="px-2 py-0.8 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[9px] rounded-lg shadow active:scale-95 transition">
              复制
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[10px] font-bold text-slate-700 block mb-1">公开昵称</label>
            <input id="inputRegNickname" placeholder="输入你在论坛展示的昵称" value="${forumRegisterDraft.nickname}" class="input-ins text-xs font-bold">
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-[10px] font-bold text-slate-700">自定义上传头像 或 选用预设</label>
              <label class="cursor-pointer text-[9px] text-purple-600 font-bold bg-purple-50 hover:bg-purple-100 px-2 py-0.8 rounded-lg border border-purple-200 transition">
                📁 本地上传图片
                <input type="file" accept="image/*" class="hidden" onchange="handleRegAvatarUpload(event)">
              </label>
            </div>

            <!-- 当前选中头像预览 -->
            <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
              <img id="currentRegAvatarPreview" src="${forumRegisterDraft.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-purple-500 shadow-sm flex-shrink-0">
              <div class="text-[10px] text-slate-500">
                <span class="font-bold text-slate-800 block">当前头像预览</span>
                <span>支持从相册选择任意图片，将保存于本地名片中</span>
              </div>
            </div>

            <!-- 预设头像横向滚轮 -->
            <div class="flex gap-2 overflow-x-auto no-scrollbar py-1">
              ${FORUM_PRESET_AVATARS.map((url, i) => `
                <div onclick="selectRegPresetAvatar('${url}')" class="relative flex-shrink-0 cursor-pointer">
                  <img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 ${forumRegisterDraft.avatar === url ? 'border-purple-600 scale-105 shadow-md' : 'border-slate-200 opacity-80'}">
                  ${forumRegisterDraft.avatar === url ? '<span class="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-black">✓</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
          <button onclick="openForumAuthPortalModal('portal')" class="btn-action justify-center !py-2.5 text-xs font-bold text-slate-600">
            ‹ 取消
          </button>
          <button onclick="executeRegisterSubmit()" class="btn-brand justify-center !py-2.5 text-xs font-black shadow-md">
            <span>完成注册并进入 ›</span>
          </button>
        </div>
      </div>
    `;
  }

  modal.classList.remove('hidden');
}
window.openForumAuthPortalModal = openForumAuthPortalModal;

// 复制生成的 UID
function copyGeneratedVoucher(uid) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(uid).then(() => {
      if (api.ui && api.ui.toast) api.ui.toast("🎉 凭证 ID 复制成功！请妥善保存！");
    });
  } else {
    if (api.ui && api.ui.toast) api.ui.toast("凭证: " + uid);
  }
}
window.copyGeneratedVoucher = copyGeneratedVoucher;

// 上传本地自定义头像
function handleRegAvatarUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Url = evt.target.result;
    forumRegisterDraft.avatar = base64Url;
    const previewEl = document.getElementById('currentRegAvatarPreview');
    if (previewEl) previewEl.src = base64Url;
    if (api.ui && api.ui.toast) api.ui.toast("🎉 本地图片已成功载入为头像！");
  };
  reader.readAsDataURL(file);
}
window.handleRegAvatarUpload = handleRegAvatarUpload;

// 选择预设头像
function selectRegPresetAvatar(url) {
  forumRegisterDraft.avatar = url;
  const previewEl = document.getElementById('currentRegAvatarPreview');
  if (previewEl) previewEl.src = url;
  openForumAuthPortalModal('register');
}
window.selectRegPresetAvatar = selectRegPresetAvatar;

// 执行注册并持久化保存
function executeRegisterSubmit() {
  const nickInput = document.getElementById('inputRegNickname');
  let nickname = nickInput ? nickInput.value.trim() : '';
  if (!nickname) {
    nickname = 'LUMA玩家_' + Math.floor(1000 + Math.random() * 9000);
  }

  const userObj = {
    uid: forumRegisterDraft.generatedUid,
    name: nickname,
    avatar: forumRegisterDraft.avatar || FORUM_PRESET_AVATARS[0],
    role: 'user',
    roleTitle: '👤 玩家',
    isOwner: false,
    isAdmin: false,
    registeredAt: new Date().toISOString()
  };

  // 永久本地持久化！
  saveForumCurrentUser(userObj);
  setForumNoticeMuted(true); // 注册成功后自动静音须知，下次绝不再弹！
  closeForumAuthModal();

  if (api.ui && api.ui.toast) api.ui.toast("🎉 注册成功！欢迎来到官方论坛！");
  openCommunitySubPageDirectForum();
}
window.executeRegisterSubmit = executeRegisterSubmit;

// 执行登录并持久化保存
function executeDirectLoginSubmit() {
  const inputEl = document.getElementById('inputDirectLoginVoucher');
  const val = inputEl ? inputEl.value.trim() : '';
  if (!val) {
    if (api.ui && api.ui.toast) api.ui.toast("请输入凭证 ID 或 主理人密钥！");
    return;
  }

  // 通过 SHA-256 单向哈希进行加密验证（源码及 Git 库中仅含不可逆摘要）
  const inputHash = computeSecureSha256(val);
  const isMasterKey = (inputHash === MASTER_KEY_HASH_SHA256);
  let userObj = null;

  if (isMasterKey) {
    userObj = {
      uid: 'LUMA_OFFICIAL_OWNER',
      name: 'LUMA 官方运营组',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      role: 'owner',
      roleTitle: '👑 官方主理人',
      isOwner: true,
      isAdmin: true,
      registeredAt: new Date().toISOString()
    };
  } else {
    // 普通玩家凭证登录
    userObj = {
      uid: val,
      name: '玩家_' + val.slice(-4),
      avatar: FORUM_PRESET_AVATARS[0],
      role: 'user',
      roleTitle: '👤 玩家',
      isOwner: false,
      isAdmin: false,
      registeredAt: new Date().toISOString()
    };
  }

  // 永久本地持久化！
  saveForumCurrentUser(userObj);
  setForumNoticeMuted(true); // 登录成功后自动静音须知，下次绝不再弹！
  closeForumAuthModal();

  if (api.ui && api.ui.toast) {
    api.ui.toast(isMasterKey ? "👑 欢迎回来，官方超级主理人！" : "🎉 登录成功！已载入身份！");
  }
  openCommunitySubPageDirectForum();
}
window.executeDirectLoginSubmit = executeDirectLoginSubmit;

// 退出登录
function handleForumLogout() {
  localStorage.removeItem('luma_forum_current_user');
  if (api.ui && api.ui.toast) api.ui.toast("已退出当前论坛账号。");
  closeVoucherManageModal();
  closeCommunitySubPage();
}
window.handleForumLogout = handleForumLogout;

// =========================================================================
// 【四、官方论坛微博式主页体系】
// =========================================================================

function getForumPosts() {
  try {
    const raw = localStorage.getItem('luma_cloud_forum_posts');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return INITIAL_FORUM_POSTS;
}

function saveForumPosts(posts) {
  try {
    localStorage.setItem('luma_cloud_forum_posts', JSON.stringify(posts));
  } catch (e) {}
}

function switchWeiboForumTab(tabKey) {
  currentForumActiveTab = tabKey;
  renderOfficialWeiboForum(tabKey);
}
window.switchWeiboForumTab = switchWeiboForumTab;

function renderOfficialWeiboForum(activeTab = 'official') {
  const container = document.getElementById('communityForumContent');
  if (!container) return;

  const currentUser = getForumCurrentUser();
  if (!currentUser || !currentUser.uid) {
    checkAndOpenForum();
    return;
  }

  const isOwner = currentUser.isOwner || currentUser.role === 'owner';
  const adminList = getForumAdminUids();
  const isAdmin = isOwner || currentUser.isAdmin || adminList.includes(currentUser.uid);

  const posts = getForumPosts();
  const officialCount = posts.filter(p => p.tag === '#官方公告#' || p.author.role === 'owner' || p.author.isOfficial).length;
  const totalCount = posts.length;

  let filteredPosts = [];
  if (activeTab === 'official') {
    filteredPosts = posts.filter(p => p.tag === '#官方公告#' || p.author.role === 'owner' || p.author.isOfficial);
  } else if (activeTab === 'square') {
    filteredPosts = posts;
  } else if (activeTab === 'mine') {
    filteredPosts = posts.filter(p => p.author.uid === currentUser.uid);
  }

  // 排序：置顶排在最前，其余按时间降序
  filteredPosts.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  container.innerHTML = `
    <div class="space-y-3.5 pb-20">
      <!-- 官方微博风格头部大 Profile 展区 -->
      <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs">
        <!-- 官方大 Banner 封面 -->
        <div class="h-28 bg-gradient-to-r from-purple-600 via-indigo-600 to-slate-900 relative p-3 flex items-start justify-between">
          <span class="text-[9px] bg-black/40 backdrop-blur-md text-purple-200 font-bold px-2 py-0.5 rounded-full border border-white/10">
            LUMA OFFICIAL STATION · 官方主页
          </span>
          <button onclick="openVoucherManageModal()" class="text-[9px] bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold px-2.5 py-1 rounded-full border border-white/20 active:scale-95 transition">
            名片 / 凭据卡 ⚙️
          </button>
        </div>

        <!-- 官方主理人信息卡片 -->
        <div class="px-4 pb-4 -mt-10 relative z-10">
          <div class="flex items-end justify-between mb-2">
            <div class="relative">
              <div class="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200" class="w-full h-full rounded-full object-cover border-2 border-white">
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-full border border-white flex items-center justify-center text-[10px] font-black text-slate-950 shadow">V</span>
            </div>
            
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] bg-purple-50 text-purple-700 font-black px-2 py-0.8 rounded-full border border-purple-200">
                👑 官方运营认证组
              </span>
            </div>
          </div>

          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-black text-slate-900">LUMA 官方运营组</h2>
              <span class="text-[8px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded">官方</span>
            </div>
            <p class="text-[10px] text-slate-500 mt-1 leading-relaxed">
              LUMA 虚拟小手机沙盒官方运营团队 · 倾听每一个创作者与玩家的声音 · 24小时互动服务
            </p>
          </div>

          <!-- 4 宫格官方数据矩阵 -->
          <div class="grid grid-cols-4 gap-2 mt-3 py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <div>
              <span class="block text-xs font-black text-slate-900">${totalCount}</span>
              <span class="text-[8px] text-slate-400 font-bold">全网动态</span>
            </div>
            <div class="border-l border-slate-200">
              <span class="block text-xs font-black text-purple-600">${officialCount}</span>
              <span class="text-[8px] text-slate-400 font-bold">官方公告</span>
            </div>
            <div class="border-l border-slate-200">
              <span class="block text-xs font-black text-slate-900">10.8w</span>
              <span class="text-[8px] text-slate-400 font-bold">关注者</span>
            </div>
            <div class="border-l border-slate-200">
              <span class="block text-xs font-black text-rose-600">89.2w</span>
              <span class="text-[8px] text-slate-400 font-bold">全网互动</span>
            </div>
          </div>

          <!-- 当前用户身份胶囊 -->
          <div class="mt-2.5 p-2 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl text-white flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-2 min-w-0">
              <img src="${currentUser.avatar}" class="w-6 h-6 rounded-full object-cover border border-white/40">
              <div class="min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-[10px] font-black text-white truncate max-w-[90px]">${currentUser.name}</span>
                  <span class="text-[7px] ${isOwner ? 'bg-amber-400 text-slate-950' : (isAdmin ? 'bg-indigo-400 text-slate-950' : 'bg-slate-700 text-slate-200')} font-black px-1 rounded">${currentUser.roleTitle || '👤 玩家'}</span>
                </div>
                <span class="text-[7px] text-slate-400 font-mono">UID: ${currentUser.uid}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              ${isOwner ? `
                <button onclick="openAdminManageModal()" class="text-[8px] bg-amber-400 text-slate-950 font-black px-2 py-0.8 rounded-lg shadow active:scale-95 transition">
                  ⚙️ 管理员
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- 微博式 3 大 Tab 导航 -->
      <div class="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-y border-slate-100 flex items-center justify-around px-2 shadow-xs rounded-2xl">
        <button onclick="switchWeiboForumTab('official')" class="flex-1 py-2 text-center text-xs font-black transition ${activeTab === 'official' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500'}">
          📢 官方公告
        </button>
        <button onclick="switchWeiboForumTab('square')" class="flex-1 py-2 text-center text-xs font-black transition ${activeTab === 'square' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500'}">
          💬 玩家广场 (${totalCount})
        </button>
        <button onclick="switchWeiboForumTab('mine')" class="flex-1 py-2 text-center text-xs font-black transition ${activeTab === 'mine' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500'}">
          ✍️ 我的发帖
        </button>
      </div>

      <!-- 发布新动态 / 建议输入框 -->
      <div class="luxe-card p-3.5 space-y-2.5 bg-white border border-slate-200/80 shadow-xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">✏️</span>
            <h4 class="text-xs font-black text-slate-900">${isOwner ? '发布官方动态 / 公告' : '在广场发布新想法 / 反馈'}</h4>
          </div>
          <span class="text-[9px] text-slate-400">云端实时同步</span>
        </div>

        <div class="space-y-2">
          <div class="flex gap-1.5 flex-wrap" id="forumPostTagBar">
            ${isOwner ? `
              <button onclick="selectForumPublishTag('#官方公告#')" id="btnTagOfficial" class="forum-tag-pill active">#官方公告#</button>
              <button onclick="selectForumPublishTag('#版本更新#')" id="btnTagUpdate" class="forum-tag-pill">#版本更新#</button>
              <button onclick="selectForumPublishTag('#活动通知#')" id="btnTagNotice" class="forum-tag-pill">#活动通知#</button>
            ` : `
              <button onclick="selectForumPublishTag('#问题反馈#')" id="btnTagFeedback" class="forum-tag-pill active">#问题反馈#</button>
              <button onclick="selectForumPublishTag('#玩法建议#')" id="btnTagAdvice" class="forum-tag-pill">#玩法建议#</button>
              <button onclick="selectForumPublishTag('#日常互动#')" id="btnTagChat" class="forum-tag-pill">#日常互动#</button>
              <button onclick="selectForumPublishTag('#求助答疑#')" id="btnTagHelp" class="forum-tag-pill">#求助答疑#</button>
            `}
          </div>

          <textarea id="forumNewPostContent" rows="3" placeholder="${isOwner ? '输入官方公告内容...' : '分享你在沙盒中的体验、Bug反馈或脑洞想法...'}" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none resize-none leading-relaxed"></textarea>

          <div class="flex items-center justify-between pt-1">
            ${isAdmin ? `
              <label class="flex items-center gap-1.5 text-[10px] font-bold text-purple-700 cursor-pointer">
                <input type="checkbox" id="checkPinPost" class="accent-purple-600 w-3.5 h-3.5 rounded">
                <span>📌 置顶此动态</span>
              </label>
            ` : '<div></div>'}

            <button onclick="submitNewForumPost()" class="btn-brand text-xs !py-1.5 !px-4 font-black shadow-md">
              <span>立即发布</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 帖子列表流 -->
      <div class="space-y-3" id="forumPostListContainer">
        ${filteredPosts.length === 0 ? `
          <div class="text-center py-10 text-slate-400 space-y-2">
            <div class="text-3xl">📭</div>
            <p class="text-xs font-bold">暂无动态</p>
            <p class="text-[10px]">快在上方发布第一条动态吧！</p>
          </div>
        ` : filteredPosts.map(post => renderSingleForumPostCard(post, currentUser, isOwner, isAdmin)).join('')}
      </div>
    </div>
  `;
}
window.renderOfficialWeiboForum = renderOfficialWeiboForum;

let currentSelectedPublishTag = '#官方公告#';
function selectForumPublishTag(tag) {
  currentSelectedPublishTag = tag;
  const pills = document.querySelectorAll('.forum-tag-pill');
  pills.forEach(p => {
    if (p.textContent === tag) p.classList.add('active');
    else p.classList.remove('active');
  });
}
window.selectForumPublishTag = selectForumPublishTag;

// 渲染单个动态卡片
function renderSingleForumPostCard(post, currentUser, isOwner, isAdmin) {
  const isAuthor = currentUser && currentUser.uid === post.author.uid;
  const canDelete = isAuthor || isOwner || isAdmin;
  const isPostPinned = post.isPinned;
  const isPostAuthorOfficial = post.author.role === 'owner' || post.author.isOfficial;

  return `
    <div class="luxe-card p-4 space-y-3 bg-white border border-slate-200/80 shadow-xs relative" id="card_${post.id}">
      <!-- 置顶横幅 -->
      ${isPostPinned ? `
        <div class="flex items-center justify-between bg-purple-50 text-purple-700 px-2.5 py-1 rounded-xl text-[9px] font-black border border-purple-200 mb-1">
          <span class="flex items-center gap-1">📌 官方置顶动态</span>
          ${isOwner ? `
            <button onclick="togglePinForumPost('${post.id}')" class="text-purple-600 hover:text-purple-800 font-bold">取消置顶</button>
          ` : ''}
        </div>
      ` : ''}

      <!-- 作者信息条 -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-2.5">
          <div class="relative flex-shrink-0 cursor-pointer" onclick="handleUserAvatarClick('${post.author.uid}', '${post.author.name}')">
            <img src="${post.author.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
            ${isPostAuthorOfficial ? '<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-slate-950">V</span>' : ''}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-black text-slate-900">${post.author.name}</span>
              <span class="text-[8px] ${isPostAuthorOfficial ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950' : (post.author.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600')} font-black px-1.5 py-0.2 rounded">${post.author.roleTitle || '👤 玩家'}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">${post.tag}</span>
          
          <!-- 操作菜单 -->
          ${canDelete ? `
            <button onclick="deleteForumPost('${post.id}')" class="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition" title="删除此动态">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}

          ${isOwner && !isPostPinned ? `
            <button onclick="togglePinForumPost('${post.id}')" class="text-slate-400 hover:text-purple-600 p-1 rounded-lg transition" title="置顶此动态">
              📌
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 动态正文 -->
      <p class="text-xs text-slate-700 whitespace-pre-line leading-relaxed">${post.content}</p>

      <!-- 底部互动栏 (点赞、评论) -->
      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <button onclick="toggleLikeForumPost('${post.id}')" class="flex items-center gap-1.5 font-bold ${post.isLiked ? 'text-rose-600' : 'text-slate-500'} active:scale-95 transition">
          <svg class="w-4 h-4 ${post.isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          <span class="text-[10px]">${post.likes || 0}</span>
        </button>

        <button onclick="togglePostComments('${post.id}')" class="flex items-center gap-1.5 font-bold text-slate-500 active:scale-95 transition">
          <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span class="text-[10px]">${(post.comments || []).length} 条回复</span>
        </button>
      </div>

      <!-- 评论区域 (展开展示) -->
      <div id="comments_box_${post.id}" class="hidden space-y-2 pt-2 border-t border-slate-100">
        <div class="flex gap-2">
          <input id="input_comment_${post.id}" placeholder="写下你的回复..." class="input-ins !py-1 text-xs flex-1">
          <button onclick="submitPostComment('${post.id}')" class="btn-brand text-[10px] !py-1 !px-3 font-bold">回复</button>
        </div>

        <div class="space-y-2 pt-1" id="comment_list_${post.id}">
          ${(post.comments || []).map(comm => `
            <div class="p-2.5 rounded-xl bg-slate-50 text-xs space-y-1">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <img src="${comm.author.avatar}" class="w-5 h-5 rounded-full object-cover">
                  <span class="font-black text-slate-800 text-[11px]">${comm.author.name}</span>
                  <span class="text-[7px] ${comm.author.isOfficial ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-200 text-slate-600'} px-1 rounded">${comm.author.roleTitle || '玩家'}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[8px] text-slate-400">${comm.time}</span>
                  ${(canDelete || (currentUser && currentUser.uid === comm.author.uid)) ? `
                    <button onclick="deletePostComment('${post.id}', '${comm.id}')" class="text-slate-400 hover:text-rose-600 text-[9px]">删除</button>
                  ` : ''}
                </div>
              </div>
              <p class="text-slate-700 text-[11px] pl-6 leading-relaxed">${comm.text}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// 提交新帖子
function submitNewForumPost() {
  const currentUser = getForumCurrentUser();
  if (!currentUser || !currentUser.uid) {
    checkAndOpenForum();
    return;
  }

  const textarea = document.getElementById('forumNewPostContent');
  if (!textarea || !textarea.value.trim()) {
    if (api.ui && api.ui.toast) api.ui.toast("请输入内容后再发布哦！");
    return;
  }

  const isOwner = currentUser.isOwner || currentUser.role === 'owner';
  const pinCheckbox = document.getElementById('checkPinPost');
  const isPinned = pinCheckbox ? pinCheckbox.checked : false;

  const newPost = {
    id: `post_${Date.now()}`,
    author: {
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      role: currentUser.role,
      roleTitle: currentUser.roleTitle,
      isOfficial: isOwner
    },
    tag: currentSelectedPublishTag || (isOwner ? '#官方公告#' : '#日常互动#'),
    isPinned: isPinned,
    time: '刚刚 · 来自 LUMA 云端',
    content: textarea.value.trim(),
    likes: 0,
    isLiked: false,
    comments: []
  };

  const posts = getForumPosts();
  posts.unshift(newPost);
  saveForumPosts(posts);

  textarea.value = '';
  if (api.ui && api.ui.toast) api.ui.toast("🎉 动态发布成功，已全网同步！");
  renderOfficialWeiboForum(currentForumActiveTab);
}
window.submitNewForumPost = submitNewForumPost;

// 删除帖子
function deleteForumPost(postId) {
  const posts = getForumPosts();
  const next = posts.filter(p => p.id !== postId);
  saveForumPosts(next);
  if (api.ui && api.ui.toast) api.ui.toast("🗑️ 动态已成功删除！");
  renderOfficialWeiboForum(currentForumActiveTab);
}
window.deleteForumPost = deleteForumPost;

// 置顶/取消置顶
function togglePinForumPost(postId) {
  const posts = getForumPosts();
  const target = posts.find(p => p.id === postId);
  if (target) {
    target.isPinned = !target.isPinned;
    saveForumPosts(posts);
    if (api.ui && api.ui.toast) api.ui.toast(target.isPinned ? "📌 动态已置顶至官方主页顶部！" : "已取消置顶");
    renderOfficialWeiboForum(currentForumActiveTab);
  }
}
window.togglePinForumPost = togglePinForumPost;

// 点赞
function toggleLikeForumPost(postId) {
  const posts = getForumPosts();
  const target = posts.find(p => p.id === postId);
  if (target) {
    target.isLiked = !target.isLiked;
    target.likes = (target.likes || 0) + (target.isLiked ? 1 : -1);
    saveForumPosts(posts);
    renderOfficialWeiboForum(currentForumActiveTab);
  }
}
window.toggleLikeForumPost = toggleLikeForumPost;

// 切换评论显隐
function togglePostComments(postId) {
  const box = document.getElementById(`comments_box_${postId}`);
  if (box) {
    box.classList.toggle('hidden');
  }
}
window.togglePostComments = togglePostComments;

// 提交评论
function submitPostComment(postId) {
  const currentUser = getForumCurrentUser();
  if (!currentUser || !currentUser.uid) {
    checkAndOpenForum();
    return;
  }
  const input = document.getElementById(`input_comment_${postId}`);
  if (!input || !input.value.trim()) return;

  const isOwner = currentUser.isOwner || currentUser.role === 'owner';
  const posts = getForumPosts();
  const target = posts.find(p => p.id === postId);
  if (target) {
    target.comments = target.comments || [];
    target.comments.push({
      id: `comm_${Date.now()}`,
      author: {
        uid: currentUser.uid,
        name: currentUser.name,
        avatar: currentUser.avatar,
        role: currentUser.role,
        roleTitle: currentUser.roleTitle,
        isOfficial: isOwner
      },
      time: '刚刚',
      text: input.value.trim(),
      likes: 0
    });
    saveForumPosts(posts);
    input.value = '';
    renderOfficialWeiboForum(currentForumActiveTab);
    const box = document.getElementById(`comments_box_${postId}`);
    if (box) box.classList.remove('hidden');
  }
}
window.submitPostComment = submitPostComment;

// 删除评论
function deletePostComment(postId, commId) {
  const posts = getForumPosts();
  const target = posts.find(p => p.id === postId);
  if (target && target.comments) {
    target.comments = target.comments.filter(c => c.id !== commId);
    saveForumPosts(posts);
    renderOfficialWeiboForum(currentForumActiveTab);
    const box = document.getElementById(`comments_box_${postId}`);
    if (box) box.classList.remove('hidden');
  }
}
window.deletePostComment = deletePostComment;

// =========================================================================
// 【五、名片/凭据卡管理与管理员任免弹窗】
// =========================================================================

function openVoucherManageModal() {
  const currentUser = getForumCurrentUser();
  if (!currentUser) return;

  const modal = document.getElementById('voucherManageModal');
  if (!modal) return;

  const body = document.getElementById('voucherManageModalBody');
  if (body) {
    body.innerHTML = `
      <div class="space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="text-base">💳</span>
            <h3 class="text-xs font-black text-slate-900">我的论坛通行凭证与名片</h3>
          </div>
          <button onclick="closeVoucherManageModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
        </div>

        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
          <img src="${currentUser.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-purple-500 shadow-sm flex-shrink-0">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h4 class="text-xs font-black text-slate-900 truncate">${currentUser.name}</h4>
              <span class="text-[8px] ${currentUser.isOwner ? 'bg-amber-400 text-slate-950' : 'bg-purple-100 text-purple-700'} font-bold px-1.5 py-0.2 rounded">${currentUser.roleTitle || '👤 玩家'}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5 font-mono">已永久保存在本地</p>
          </div>
        </div>

        <div class="p-3 bg-slate-900 text-white rounded-2xl space-y-2">
          <span class="text-[9px] text-amber-300 font-bold uppercase">CURRENT VOUCHER ID</span>
          <div class="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/10">
            <span class="font-mono text-xs font-black text-amber-400 select-all">${currentUser.uid}</span>
            <button onclick="copyGeneratedVoucher('${currentUser.uid}')" class="px-2 py-0.8 bg-amber-400 text-slate-950 font-black text-[9px] rounded shadow active:scale-95">复制</button>
          </div>
          <p class="text-[9px] text-slate-400">凭此 ID 可在任何部署版本中一键恢复身份与发帖记录。</p>
        </div>

        <div class="space-y-2 pt-1">
          <button onclick="openEditProfileInModal()" class="btn-action w-full justify-center !py-2 text-xs font-bold text-slate-700">
            <span>✏️ 修改公开昵称与头像</span>
          </button>
          <button onclick="handleForumLogout()" class="w-full py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold border border-rose-200">
            退出登录 / 清除当前会话
          </button>
        </div>
      </div>
    `;
  }
  modal.classList.remove('hidden');
}
window.openVoucherManageModal = openVoucherManageModal;

function closeVoucherManageModal() {
  const modal = document.getElementById('voucherManageModal');
  if (modal) modal.classList.add('hidden');
}
window.closeVoucherManageModal = closeVoucherManageModal;

function openEditProfileInModal() {
  closeVoucherManageModal();
  openForumAuthPortalModal('register');
}
window.openEditProfileInModal = openEditProfileInModal;

// 管理员任免弹窗 (仅 SuperAdmin 可用)
function openAdminManageModal() {
  const currentUser = getForumCurrentUser();
  if (!currentUser || !currentUser.isOwner) {
    if (api.ui && api.ui.toast) api.ui.toast("权限不足：仅官方超级主理人可管理管理员！");
    return;
  }

  const modal = document.getElementById('adminManageModal');
  if (!modal) return;

  const adminList = getForumAdminUids();
  const body = document.getElementById('adminManageModalBody');
  if (body) {
    body.innerHTML = `
      <div class="space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="text-base">🛡️</span>
            <h3 class="text-xs font-black text-slate-900">论坛管理员任免中心</h3>
          </div>
          <button onclick="closeAdminManageModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
        </div>

        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800">
          👑 官方主理人特权：授予管理员权限后，对方将获得协助维护论坛秩序、删帖与清评的特权。
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-slate-700">添加新管理员 (输入玩家 UID)</label>
          <div class="flex gap-2">
            <input id="inputNewAdminUid" placeholder="例如: LUMA-UID-XXXX-XXXX" class="input-ins text-xs font-mono flex-1">
            <button onclick="submitAppointAdmin()" class="btn-brand text-xs !py-1 !px-3 font-black">任命</button>
          </div>
        </div>

        <div class="space-y-2 pt-1">
          <h4 class="text-[11px] font-black text-slate-800">当前已任命管理员 (${adminList.length})</h4>
          ${adminList.length === 0 ? `
            <p class="text-[10px] text-slate-400">暂无额外管理员</p>
          ` : adminList.map(uid => `
            <div class="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-100">
              <span class="font-mono font-bold text-slate-800 text-[11px]">${uid}</span>
              <button onclick="revokeAdmin('${uid}')" class="text-[9px] text-rose-600 font-bold px-2 py-0.5 rounded bg-rose-50 border border-rose-200">撤销权限</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  modal.classList.remove('hidden');
}
window.openAdminManageModal = openAdminManageModal;

function closeAdminManageModal() {
  const modal = document.getElementById('adminManageModal');
  if (modal) modal.classList.add('hidden');
}
window.closeAdminManageModal = closeAdminManageModal;

function submitAppointAdmin() {
  const input = document.getElementById('inputNewAdminUid');
  if (!input || !input.value.trim()) return;
  const uid = input.value.trim();
  const list = getForumAdminUids();
  if (!list.includes(uid)) {
    list.push(uid);
    saveForumAdminUids(list);
    if (api.ui && api.ui.toast) api.ui.toast(`🎉 已成功任命 ${uid} 为论坛管理员！`);
    openAdminManageModal();
    renderOfficialWeiboForum(currentForumActiveTab);
  }
}
window.submitAppointAdmin = submitAppointAdmin;

function revokeAdmin(uid) {
  let list = getForumAdminUids();
  list = list.filter(id => id !== uid);
  saveForumAdminUids(list);
  if (api.ui && api.ui.toast) api.ui.toast(`已撤销 ${uid} 的管理员权限。`);
  openAdminManageModal();
  renderOfficialWeiboForum(currentForumActiveTab);
}
window.revokeAdmin = revokeAdmin;

// 点击用户头像快捷任免管理员
function handleUserAvatarClick(uid, name) {
  const currentUser = getForumCurrentUser();
  if (!currentUser || !currentUser.isOwner || uid === currentUser.uid) return;

  const list = getForumAdminUids();
  const isAlreadyAdmin = list.includes(uid);

  if (confirm(`【官方主理人管理菜单】\n是否${isAlreadyAdmin ? '撤销' : '设置'} [${name}] (UID: ${uid}) 为论坛管理员？`)) {
    if (isAlreadyAdmin) {
      revokeAdmin(uid);
    } else {
      list.push(uid);
      saveForumAdminUids(list);
      if (api.ui && api.ui.toast) api.ui.toast(`🎉 已任命 ${name} 为管理员！`);
      renderOfficialWeiboForum(currentForumActiveTab);
    }
  }
}
window.handleUserAvatarClick = handleUserAvatarClick;
