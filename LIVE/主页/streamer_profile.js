// =========================================================================
// 【主播个人主页模块】LIVE/主页/streamer_profile.js
// 由 LIVE/直播/live.js 迁移整理（2026-08-23），职责归档到主页文件夹
// 包含：主播档案生成（人设+世界书 AI 驱动初始值）、主页渲染、铅笔编辑档案、
//       关注、直播场次、相册、留言墙、主播空间页面管理
// =========================================================================

var api = window.api || {};

// -------------------------------------------------------------------------
// 全局状态（原 live.js 模块级变量 → window 挂载，便于跨模块访问）
// -------------------------------------------------------------------------
window.streamerProfilesMap = window.streamerProfilesMap || {};
window.currentViewingProfile = null;
window.activeSpTab = 'shows';   // 默认 Tab：直播场次（动态 Tab 已隐藏，等社区真实功能）

// -------------------------------------------------------------------------
// 主播人设预设（初始值兜底库：AI 生成不可用/失败时回退）
// -------------------------------------------------------------------------
const STREAMER_PERSONA_PRESETS = [
  {
    keywords: ['歌', '音乐', '唱', '音', '曲', '乐'],
    bio: '心怀旷野，在直播间弹琴唱歌给你听。商务合作/演出请私信联系经纪人~ 🎧',
    category: '音乐主唱',
    tags: ['#原创音乐人', '#治愈系弹唱', '#深夜电台', '#声优大V'],
    fanClub: '星光守护团'
  },
  {
    keywords: ['电竞', '游', '玩', '战', '王者', '吃鸡', '原神', '二次元', '宅'],
    bio: '峡谷百星野王 / 技术流游戏少女。每天固定晚8点带粉上分，不鸽！🎮',
    category: '电竞高玩',
    tags: ['#王者百星', '#硬核技术流', '#单排冲国服', '#下饭日常'],
    fanClub: '极客特战队'
  },
  {
    keywords: ['搞笑', '脱口秀', '话痨', '聊', '幽默', '逗'],
    bio: '全网最严肃的搞笑主播。进来聊天不要喝水，呛到了我不赔！🍉',
    category: '娱乐脱口秀',
    tags: ['#搞笑博主', '#人间清醒', '#连麦整活', '#段子手'],
    fanClub: '快乐制造局'
  },
  {
    keywords: ['舞', '才艺', '美', '仙', '古风', '雅'],
    bio: '一袭清欢，舞动人间烟火。LUMA年度舞蹈赛道十佳主播。✨',
    category: '舞蹈艺术',
    tags: ['#国风舞蹈', '#古典舞', '#仙气飘飘', '#年度十佳'],
    fanClub: '青鸾阁'
  },
  {
    keywords: ['默认', '主播'],
    bio: '记录真实生活，与你分享每一次开播的温柔与心动。💛',
    category: '签约大V',
    tags: ['#生活日常', '#治愈互动', '#签约主播', '#真诚分享'],
    fanClub: '星光守护团'
  }
];

// -------------------------------------------------------------------------
// 主播档案生成（同步兜底版：posts 已清空，动态等社区真实功能）
// -------------------------------------------------------------------------
function getOrGenerateStreamerProfile(characterId, characterObj) {
  if (!characterId) return null;
  if (window.streamerProfilesMap[characterId]) {
    return window.streamerProfilesMap[characterId];
  }
  const idStr = String(characterId || 'char_01');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) hash += idStr.charCodeAt(i) * (i + 13);
  
  const totalShows = (characterObj && characterObj.totalShows) ? Number(characterObj.totalShows) : (38 + (hash % 290));
  const avgFansPerShow = 360 + (hash % 420);
  const baseFans = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(characterId, characterObj)
    : (totalShows * avgFansPerShow + 2400 + (hash % 5000));
  const followCount = 28 + (hash % 150);
  const likesCount = Math.floor(baseFans * (3.8 + (hash % 5) * 0.8));
  
  const ipList = ['广东', '上海', '北京', '浙江', '四川', '江苏', '山东', '湖北', '东京', '首尔'];
  const ipLocation = ipList[hash % ipList.length];
  const joinDays = Math.max(30, Math.floor(totalShows * 1.6 + (hash % 60)));
  
  const charName = characterObj?.name || '主播';
  const charDesc = characterObj?.description || characterObj?.persona || characterObj?.category || '';
  const fullText = `${charName} ${charDesc}`;
  
  let matchedPreset = STREAMER_PERSONA_PRESETS[STREAMER_PERSONA_PRESETS.length - 1];
  for (let p of STREAMER_PERSONA_PRESETS) {
    if (p.keywords.some(k => fullText.includes(k))) {
      matchedPreset = p;
      break;
    }
  }
  
  const bio = (characterObj && characterObj.bio) ? characterObj.bio : matchedPreset.bio;
  const category = (characterObj && (characterObj.subTag || characterObj.category)) ? (characterObj.subTag || characterObj.category) : matchedPreset.category;
  const tags = matchedPreset.tags;
  const fanClubName = matchedPreset.fanClub;
  const verifyTitle = `LUMA 平台年度认证大V主播 · ${category}`;
  
  // 动态 posts：已清空（随机动态下线，等待社区真实功能接入）
  const posts = [];
  
  const showsHistory = [];
  const titlesPool = [
    `深夜治愈弹唱会 · 唱给每一个未眠的你`,
    `冲国服巅峰赛！带粉车队极速发车`,
    `聊天互动碎碎念 · 聊聊最近发生的好玩事`,
    `开箱测评与好物分享专场`,
    `粉丝专属连麦PK！输了有惩罚哦`,
    `早安元气电台 · 开启美好的一天`
  ];
  for (let i = 0; i < Math.min(8, totalShows); i++) {
    const showNum = totalShows - i;
    const durMins = 90 + ((hash + i * 27) % 150);
    const h = Math.floor(durMins / 60);
    const m = durMins % 60;
    showsHistory.push({
      showNumber: showNum,
      title: `第 ${showNum} 场 · ${titlesPool[(hash + i) % titlesPool.length]}`,
      duration: `${h}小时${m}分`,
      heat: ((hash * 13 + i * 1500) % 65000 + 25000).toLocaleString(),
      newFans: `+${300 + ((hash + i * 17) % 450)} 粉丝`,
      timeAgo: `${i === 0 ? '刚刚' : (i === 1 ? '昨天' : `${i + 1}天前`)}`
    });
  }
  
  const cover = characterObj?.cover || '';
  const avatar = characterObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
  const gallery = [cover, avatar, cover, avatar, cover, avatar];
  
  const profile = {
    characterId,
    name: charName,
    avatar,
    cover,
    vip: characterObj?.vip || `VIP ${8 + (hash % 3)}`,
    totalShows,
    baseFans,
    avgFansPerShow,
    followCount,
    likesCount,
    bio,
    category,
    tags,
    fanClubName,
    verifyTitle,
    ipLocation,
    joinDays,
    posts,
    showsHistory,
    gallery
  };
  
  window.streamerProfilesMap[characterId] = profile;
  return profile;
}
window.getOrGenerateStreamerProfile = getOrGenerateStreamerProfile;

function getHostBaseFans(characterId, room) {
  const prof = getOrGenerateStreamerProfile(characterId, room);
  return prof ? prof.baseFans : 12800;
}
window.getHostBaseFans = getHostBaseFans;

function incrementStreamerLiveShow(characterId) {
  const profile = getOrGenerateStreamerProfile(characterId);
  if (profile) {
    profile.totalShows += 1;
    const newGain = Math.floor(profile.avgFansPerShow * (0.8 + Math.random() * 0.4));
    profile.baseFans += newGain;
    profile.likesCount += Math.floor(newGain * 4.5);
    profile.showsHistory.unshift({
      showNumber: profile.totalShows,
      title: `第 ${profile.totalShows} 场 · 精彩互动专场`,
      duration: '1小时45分',
      heat: (45000 + Math.floor(Math.random() * 20000)).toLocaleString(),
      newFans: `+${newGain} 粉丝`,
      timeAgo: '刚刚'
    });
    if (window.currentViewingProfile && window.currentViewingProfile.characterId === characterId) {
      renderStreamerProfileToUI(profile);
    }
    if (typeof window.updateLiveRoomHostFansDisplay === 'function') {
      window.updateLiveRoomHostFansDisplay();
    }
  }
}
window.incrementStreamerLiveShow = incrementStreamerLiveShow;

// -------------------------------------------------------------------------
// AI 初始值生成：读取角色人设 + 世界书，生成符合设定的档案五项
// （个性签名 / 平台认证 / IP属地 / 粉丝团前缀 / 四个#标签）
// 失败时返回 null，由调用方回退到兜底预设值
// -------------------------------------------------------------------------
async function generateProfileAISettings(characterId) {
  try {
    // 1. 读取角色人设（persona / description）
    let persona = '';
    try {
      if (api.characters && typeof api.characters.get === 'function') {
        const full = await api.characters.get(characterId);
        persona = full?.persona || full?.description || '';
      }
    } catch (e) {}
    const charObj = (window.allCharacters || []).find(c => c.id === characterId);
    const charName = charObj?.name || '主播';

    // 2. 读取世界书（世界观背景，取前若干条摘要）
    let worldSummary = '';
    try {
      if (api.world && typeof api.world.list === 'function') {
        const entries = await api.world.list();
        if (entries && entries.length) {
          worldSummary = entries.slice(0, 3).map(en => {
            const title = en?.title || en?.name || '';
            const content = String(en?.content || en?.text || '').slice(0, 120);
            return title ? `${title}：${content}` : content;
          }).filter(Boolean).join('\n').slice(0, 500);
        }
      }
    } catch (e) {}

    // 3. 构造提示词，请求 AI 生成档案
    const instruction = [
      '你是 LUMA 直播平台的【主播档案生成系统】。',
      '请根据角色人设与世界观，为直播间主播生成一份个性化档案。',
      '',
      `角色名：${charName}`,
      `角色人设：${persona || '（无详细设定）'}`,
      `世界观背景：${worldSummary || '（无世界书设定）'}`,
      '',
      '要求：',
      '1. 个性签名(bio)：贴合角色性格的一句话，20字以内',
      '2. 平台认证(verifyTitle)：如"LUMA年度认证大V主播·赛道名"，16字以内',
      '3. IP属地(ipLocation)：结合世界观风格生成，2~6字（如：广东 / 上海 / 赛博星云-新京都）',
      '4. 粉丝团前缀(fanClubPrefix)：2~4字，与角色气质相符，不要包含"粉丝团"三个字',
      '5. 四个标签(tags)：以#开头，与角色特质相关',
      '',
      '只输出 JSON，不要输出任何其他内容：',
      '{"bio":"","verifyTitle":"","ipLocation":"","fanClubPrefix":"","tags":["#","#","#","#"]}'
    ].join('\n');

    const res = await window.aiGenerate({ characterId, instruction, appTags: ['luma', 'profile'] });
    const data = (window.extractJsonFromText && typeof window.extractJsonFromText === 'function')
      ? window.extractJsonFromText(res.text)
      : null;
    if (!data) return null;

    const settings = {
      bio: String(data.bio || '').trim(),
      verifyTitle: String(data.verifyTitle || '').trim(),
      ipLocation: String(data.ipLocation || '').trim(),
      fanClubPrefix: String(data.fanClubPrefix || '').trim().replace(/粉丝团$/, ''),
      tags: (Array.isArray(data.tags) ? data.tags : [])
        .slice(0, 4)
        .map(t => String(t).trim())
        .filter(Boolean)
    };
    // 标签不足 4 个时用默认补齐
    const defaultTags = ['#签约主播', '#人气新星', '#直播日常', '#互动达人'];
    while (settings.tags.length < 4) {
      settings.tags.push(defaultTags[settings.tags.length]);
    }
    return settings;
  } catch (e) {
    console.warn('[LUMA] AI 档案生成失败，使用兜底初始值:', e);
    return null;
  }
}
window.generateProfileAISettings = generateProfileAISettings;

function applyAISettings(profile, settings) {
  if (!profile || !settings) return;
  if (settings.bio) profile.bio = settings.bio;
  if (settings.verifyTitle) profile.verifyTitle = settings.verifyTitle;
  if (settings.ipLocation) profile.ipLocation = settings.ipLocation;
  if (settings.fanClubPrefix) profile.fanClubName = settings.fanClubPrefix + '粉丝团';
  if (Array.isArray(settings.tags) && settings.tags.length >= 4) {
    profile.tags = settings.tags.slice(0, 4);
  }
}

// -------------------------------------------------------------------------
// 打开 / 关闭主播个人主页
// -------------------------------------------------------------------------
async function openStreamerProfilePage(id) {
  let charObj = (window.allCharacters || []).find(c => c.id === id) || (window.liveList || []).find(s => s.characterId === id || s.id === id);
  if (!charObj && id) {
    charObj = { id, name: '主播', avatar: '' };
  }
  if (!charObj) return;

  const profile = getOrGenerateStreamerProfile(charObj.id || charObj.characterId || id, charObj);
  if (!profile) return;

  // 从本地数据库读取用户自定义封面
  try {
    const savedCover = await api.db.get('streamer_covers', profile.characterId).catch(() => null);
    if (savedCover && savedCover.cover) {
      profile.cover = savedCover.cover;
    }
  } catch (e) {}

  // 读取档案：编辑存档 > AI 生成存档 > 实时 AI 生成（失败回退兜底预设）
  try {
    const saved = await api.db.get('streamer_profile_edits', profile.characterId).catch(() => null);
    if (saved) {
      if (saved.verifyTitle) profile.verifyTitle = saved.verifyTitle;
      if (saved.bio) profile.bio = saved.bio;
      if (saved.ipLocation) profile.ipLocation = saved.ipLocation;
      if (saved.fanClubName) profile.fanClubName = saved.fanClubName;
      if (Array.isArray(saved.tags) && saved.tags.length) profile.tags = saved.tags;
    } else {
      const cached = await api.db.get('streamer_profile_ai', profile.characterId).catch(() => null);
      if (cached && cached.settings) {
        applyAISettings(profile, cached.settings);
      } else {
        // 异步 AI 生成（人设 + 世界书），成功后应用并缓存；失败静默保持兜底值
        generateProfileAISettings(profile.characterId).then(settings => {
          if (!settings) return;
          applyAISettings(profile, settings);
          api.db.create('streamer_profile_ai', { id: profile.characterId, settings, time: Date.now() }).catch(() => {});
          if (window.currentViewingProfile && window.currentViewingProfile.characterId === profile.characterId) {
            renderStreamerProfileToUI(profile);
          }
        });
      }
    }
  } catch (e) {}

  window.currentViewingProfile = profile;
  renderStreamerProfileToUI(profile);

  // 使用统一页面栈管理器打开个人主页
  if (window.PageStack) {
    window.PageStack.open('streamerProfilePageView');
  } else {
    // 降级：直接操作 DOM
    const page = document.getElementById('streamerProfilePageView');
    if (page) page.classList.add('open');
  }
}
window.openStreamerProfilePage = openStreamerProfilePage;
window.openStreamerSpace = openStreamerProfilePage;

function closeStreamerProfilePage() {
  // 使用统一页面栈管理器返回
  if (window.PageStack) {
    window.PageStack.back();
  } else {
    // 降级：直接操作 DOM
    const page = document.getElementById('streamerProfilePageView');
    if (page) page.classList.remove('open');
    window.currentViewingProfile = null;
  }
}
window.closeStreamerProfilePage = closeStreamerProfilePage;
window.closeStreamerSpace = closeStreamerProfilePage;

function renderStreamerProfileToUI(p) {
  const coverEl = document.getElementById('spCoverImg');
  const avatarEl = document.getElementById('spAvatar');
  if (coverEl) {
    if (p.cover) {
      coverEl.src = p.cover;
      coverEl.style.display = 'block';
    } else {
      coverEl.removeAttribute('src');
      coverEl.style.display = 'none';
    }
  }
  if (avatarEl) avatarEl.src = p.avatar;

  const nameEl = document.getElementById('spName');
  const vipEl = document.getElementById('spVipTag');
  const catEl = document.getElementById('spCategoryBadge');
  const verifyEl = document.getElementById('spVerifyTitle');
  if (nameEl) nameEl.textContent = p.name;
  if (vipEl) vipEl.textContent = p.vip;
  if (catEl) catEl.textContent = p.category;
  if (verifyEl) verifyEl.textContent = p.verifyTitle;

  const isFollowed = (window.followedHosts || []).includes(p.characterId);
  const totalFans = p.baseFans + (isFollowed ? 1 : 0);
  const fansEl = document.getElementById('spFansCount');
  const showsEl = document.getElementById('spLiveShowsCount');
  const followEl = document.getElementById('spFollowCount');
  const likesEl = document.getElementById('spLikesCount');

  if (fansEl) fansEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();
  if (showsEl) showsEl.textContent = `${p.totalShows} 场`;
  if (followEl) followEl.textContent = p.followCount;
  if (likesEl) likesEl.textContent = p.likesCount >= 10000 ? (p.likesCount / 10000).toFixed(1) + '万' : p.likesCount.toLocaleString();

  const bioEl = document.getElementById('spBioText');
  const ipEl = document.getElementById('spIpLocation');
  const joinEl = document.getElementById('spJoinDays');
  const clubEl = document.getElementById('spFanClubName');
  if (bioEl) bioEl.textContent = p.bio;
  if (ipEl) ipEl.textContent = `IP属地: ${p.ipLocation}`;
  if (joinEl) joinEl.textContent = `入驻 ${p.joinDays} 天`;
  if (clubEl) clubEl.textContent = `粉丝团: ${p.fanClubName}`;

  const tagsBox = document.getElementById('spTagsContainer');
  if (tagsBox) {
    tagsBox.innerHTML = (p.tags || []).map(t => `<span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">${t}</span>`).join('');
  }

  updateSpFollowBtnState();

  const isLive = (window.liveList || []).some(l => (l.characterId === p.characterId || l.id === p.characterId) && l.isLive !== false);
  const goLiveBtn = document.getElementById('spBtnGoLiveRoom');
  if (goLiveBtn) {
    if (isLive) goLiveBtn.classList.remove('hidden');
    else goLiveBtn.classList.add('hidden');
  }

  switchSpTab(window.activeSpTab);
}

// 本地上传个人主页封面
function handleStreamerCoverUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    if (api.ui?.toast) api.ui.toast('请选择图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    if (window.currentViewingProfile) {
      window.currentViewingProfile.cover = dataUrl;
      const coverEl = document.getElementById('spCoverImg');
      if (coverEl) {
        coverEl.src = dataUrl;
        coverEl.style.display = 'block';
      }
      // 持久化到本地数据库
      const charId = window.currentViewingProfile.characterId;
      api.db.create('streamer_covers', { id: charId, cover: dataUrl, time: Date.now() }).catch(() => {
        api.db.update('streamer_covers', charId, { cover: dataUrl, time: Date.now() }).catch(() => {});
      });
      if (api.ui?.toast) api.ui.toast('封面已更新');
    }
  };
  reader.readAsDataURL(file);
  // 清空 input，允许重复选同一张图
  e.target.value = '';
}
window.handleStreamerCoverUpload = handleStreamerCoverUpload;

function updateSpFollowBtnState() {
  if (!window.currentViewingProfile) return;
  const isFollowed = (window.followedHosts || []).includes(window.currentViewingProfile.characterId);
  const btn = document.getElementById('spBtnFollow');
  const txt = document.getElementById('spFollowBtnText');
  if (btn && txt) {
    if (isFollowed) {
      btn.className = "px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 active:scale-95 transition flex items-center gap-1";
      txt.textContent = "已关注";
      const icon = btn.querySelector('svg');
      if (icon) icon.classList.add('hidden');
    } else {
      btn.className = "px-4 py-1.5 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm active:scale-95 transition flex items-center gap-1";
      txt.textContent = "关注";
      const icon = btn.querySelector('svg');
      if (icon) icon.classList.remove('hidden');
    }
  }
}

async function spToggleFollow() {
  if (!window.currentViewingProfile) return;
  const charId = window.currentViewingProfile.characterId;
  const isFollowed = (window.followedHosts || []).includes(charId);

  if (isFollowed) {
    window.followedHosts = (window.followedHosts || []).filter(id => id !== charId);
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
  } else {
    if (!window.followedHosts.includes(charId)) {
      window.followedHosts.push(charId);
    }
    await api.db.create("follows", { id: charId, timestamp: Date.now() }).catch(() => {});
    api.ui.toast("关注成功！");
  }

  updateSpFollowBtnState();
  if (typeof window.updateLiveRoomHostFansDisplay === 'function') {
    window.updateLiveRoomHostFansDisplay();
  }

  const totalFans = window.currentViewingProfile.baseFans + ((window.followedHosts || []).includes(charId) ? 1 : 0);
  const fansEl = document.getElementById('spFansCount');
  if (fansEl) fansEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();

  const statEl = document.getElementById('statFollowCount');
  if (statEl) statEl.textContent = window.followedHosts.length + 1;
}
window.spToggleFollow = spToggleFollow;

// -------------------------------------------------------------------------
// Tab 切换（动态 Tab 已下线，仅保留：直播场次 / 相册 / 留言墙）
// -------------------------------------------------------------------------
function switchSpTab(tab) {
  window.activeSpTab = tab;
  const tabs = ['shows', 'gallery', 'guestbook'];
  tabs.forEach(t => {
    const tabEl = document.getElementById(`spTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const panelEl = document.getElementById(`spPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (tabEl) {
      if (t === tab) tabEl.classList.add('active');
      else tabEl.classList.remove('active');
    }
    if (panelEl) {
      if (t === tab) panelEl.classList.remove('hidden');
      else panelEl.classList.add('hidden');
    }
  });

  if (!window.currentViewingProfile) return;

  if (tab === 'shows') renderSpShows();
  else if (tab === 'gallery') renderSpGallery();
  else if (tab === 'guestbook') renderSpGuestbook();
}
window.switchSpTab = switchSpTab;

function renderSpShows() {
  const box = document.getElementById('spPanelShows');
  if (!box || !window.currentViewingProfile) return;
  const p = window.currentViewingProfile;

  box.innerHTML = `
    <div class="bg-gradient-to-r from-rose-500 to-pink-500 p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between mb-3">
      <div>
        <span class="text-[10px] text-white/80 font-bold">历史开播总览</span>
        <div class="text-base font-black mt-0.5">累计直播 ${p.totalShows} 场</div>
      </div>
      <div class="text-right">
        <span class="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">场均增粉 +${p.avgFansPerShow}</span>
      </div>
    </div>
    <div class="space-y-2.5">
      ${p.showsHistory.map(s => `
        <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <h4 class="text-xs font-bold text-slate-900">${s.title}</h4>
            <div class="flex items-center gap-2 text-[10px] text-slate-400">
              <span>时长: ${s.duration}</span>
              <span>·</span>
              <span>人气: ${s.heat}</span>
              <span>·</span>
              <span class="text-rose-500 font-bold">${s.newFans}</span>
            </div>
          </div>
          <span class="text-[9px] text-slate-400 font-medium">${s.timeAgo}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSpGallery() {
  const box = document.getElementById('spPanelGallery');
  if (!box || !window.currentViewingProfile) return;
  const p = window.currentViewingProfile;
  
  box.innerHTML = `
    <div class="gallery-grid-3">
      ${p.gallery.filter(img => img).map(img => `
        <img src="${img}" onclick="api.ui.toast('已查看高清大图')" class="rounded-xl shadow-xs">
      `).join('')}
    </div>
  `;
}

function renderSpGuestbook() {
  const box = document.getElementById('spaceGuestbookList');
  if (!box || !window.currentViewingProfile) return;
  const list = (window.guestbookData && window.guestbookData[window.currentViewingProfile.characterId]) || [];
  box.innerHTML = list.length === 0 ? '<p class="text-[11px] text-slate-400 py-3 text-center">暂无留言，快来给主播抢个沙发吧~</p>' : list.map(m => `
    <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs space-y-1.5">
      <div class="flex justify-between text-[10px]">
        <span class="font-bold text-slate-900">${m.user}</span>
        <span class="text-slate-400">${m.time || '刚刚'}</span>
      </div>
      <p class="text-xs text-slate-700 leading-relaxed">${m.text}</p>
      ${m.reply ? `<div class="mt-2 p-2 bg-rose-50 rounded-xl border border-rose-100 text-[11px] text-rose-800"><strong>主播回复：</strong>${m.reply}</div>` : ''}
    </div>
  `).join('');
}

async function submitGuestbookComment() {
  const input = document.getElementById('inputSpaceComment');
  if (!input) return;
  const val = input.value.trim();
  if (!val || !window.currentViewingProfile) return;

  const hostId = window.currentViewingProfile.characterId;
  if (!window.guestbookData[hostId]) window.guestbookData[hostId] = [];
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const item = {
    id: `gb_${Date.now()}`,
    hostId: hostId,
    user: uName,
    text: val,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reply: null
  };
  window.guestbookData[hostId].unshift(item);
  input.value = '';

  const rate = ((window.appParams && window.appParams.guestbookRate !== undefined) ? window.appParams.guestbookRate : 75) / 100;
  if (Math.random() < rate) {
    try {
      const res = await window.aiGenerate({
        characterId: hostId,
        instruction: `粉丝【${uName}】在你的主页留言：“${val}”。请以你的角色人设简短温馨回复一句。`
      });
      item.reply = res.text;
    } catch (e) {}
  }
  renderSpGuestbook();
  try { await api.db.create("guestbook", item); } catch (e) {}
}
window.submitGuestbookComment = submitGuestbookComment;

function spEnterLiveRoom() {
  if (!window.currentViewingProfile) return;
  const live = (window.liveList || []).find(l => l.characterId === window.currentViewingProfile.characterId || l.id === window.currentViewingProfile.characterId);
  if (live) {
    closeStreamerProfilePage();
    if (typeof window.enterLiveRoom === 'function') {
      window.enterLiveRoom(live.id);
    }
  } else {
    api.ui.toast("主播当前不在直播中");
  }
}
window.spEnterLiveRoom = spEnterLiveRoom;

// -------------------------------------------------------------------------
// 铅笔编辑档案：个人认证 / 个性签名 / IP属地 / 粉丝团前缀 / 四个#标签
// -------------------------------------------------------------------------
function spOpenProfileEdit() {
  if (!window.currentViewingProfile) return;
  const p = window.currentViewingProfile;
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || '';
  };
  setVal('peVerifyTitle', p.verifyTitle || '');
  setVal('peBio', p.bio || '');
  setVal('peIpLocation', String(p.ipLocation || '').replace(/^IP属地[:：]?\s*/, ''));
  // 粉丝团：输入框只填前缀，右侧"粉丝团"三字固定
  setVal('peFanClubPrefix', String(p.fanClubName || '').replace(/粉丝团$/, ''));
  const tags = p.tags || [];
  for (let i = 0; i < 4; i++) setVal('peTag' + (i + 1), tags[i] || '');

  const modal = document.getElementById('profileEditModal');
  if (modal) modal.classList.remove('hidden');
}
window.spOpenProfileEdit = spOpenProfileEdit;

async function spSaveProfileEdit() {
  if (!window.currentViewingProfile) return;
  const p = window.currentViewingProfile;
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const verifyTitle = getVal('peVerifyTitle');
  const bio = getVal('peBio');
  const ipLocation = getVal('peIpLocation');
  const prefix = getVal('peFanClubPrefix');
  const tags = [getVal('peTag1'), getVal('peTag2'), getVal('peTag3'), getVal('peTag4')].filter(Boolean);

  if (!prefix) {
    if (api.ui?.toast) api.ui.toast('请填写粉丝团前缀（"粉丝团"三个字固定）');
    return;
  }

  // 应用到当前档案（"粉丝团"三字固定，只改前缀）
  const fanClubName = prefix + '粉丝团';
  if (verifyTitle) p.verifyTitle = verifyTitle;
  if (bio) p.bio = bio;
  if (ipLocation) p.ipLocation = ipLocation;
  p.fanClubName = fanClubName;
  if (tags.length) p.tags = tags;

  // 持久化到本地数据库（编辑存档优先于 AI/随机初始值）
  const record = { id: p.characterId, verifyTitle, bio, ipLocation, fanClubName, tags, time: Date.now() };
  try {
    await api.db.create('streamer_profile_edits', record);
  } catch (e) {
    try { await api.db.update('streamer_profile_edits', p.characterId, record); } catch (e2) {}
  }

  renderStreamerProfileToUI(p);
  closeProfileEditModal();
  if (api.ui?.toast) api.ui.toast('主播档案已更新');
}
window.spSaveProfileEdit = spSaveProfileEdit;

function closeProfileEditModal() {
  const modal = document.getElementById('profileEditModal');
  if (modal) modal.classList.add('hidden');
}
window.closeProfileEditModal = closeProfileEditModal;

function openCurrentHostProfile() {
  if (window.currentRoom) {
    openStreamerProfilePage(window.currentRoom.characterId || window.currentRoom.id);
  }
}
window.openCurrentHostProfile = openCurrentHostProfile;

// -------------------------------------------------------------------------
// 【统一页面栈注册】个人主页
// -------------------------------------------------------------------------
if (window.PageStack) {
  window.PageStack.register('streamerProfilePageView', {
    element: document.getElementById('streamerProfilePageView'),
    openClass: 'open',
    hiddenClass: null,  // 个人主页用 transform 定位，不用 hidden 类
    onClose: () => {
      window.currentViewingProfile = null;
    },
  });
}
