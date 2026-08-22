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
window.activeSpTab = 'posts';   // 默认 Tab：动态（动态 Tab 保留，随机内容已清空）

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
// 【本地规则引擎】档案初始值生成（不调 API，纯本地 SDK 读取 + 规则匹配）
// 首次打开主播主页时：读取角色人设 + 世界书 → 本地关键词识别风格/世界观
// → 从预置模板库按风格随机组合生成档案五项，瞬时完成，结果缓存到宿主 db
// -------------------------------------------------------------------------

// 风格库：关键词 → 档案模板（个签/认证/粉丝团前缀/标签候选池）
const PROFILE_STYLE_LIBRARY = {
  cool: {
    keywords: ['傲', '冷', '高冷', '毒舌', '犀利', '不服', '学霸', '女王', '酷', '拽', '冰山'],
    bioPool: ['白天高冷话少，晚上峡谷乱杀，别惹我。', '我行我素，只对值得的人温柔。', '胜负欲拉满，菜就多练，谢绝抬杠。'],
    verifyPool: ['LUMA年度认证大V主播 · 个性赛道', 'LUMA平台认证人气主播 · 高能对决'],
    fanClubPool: ['星环战队', '冷焰骑士', '孤傲之巅'],
    tagsPool: ['#高冷学霸', '#峡谷之巅', '#深夜开黑', '#人间清醒', '#单排百星', '#技术流', '#不服来战', '#反差萌']
  },
  warm: {
    keywords: ['温柔', '治愈', '暖', '甜', '贴心', '邻家', '软', '陪伴'],
    bioPool: ['把温柔和好心情都留给你，每晚见。', '想成为你屏幕那头的治愈小太阳。', '生活很苦，但直播间很甜。'],
    verifyPool: ['LUMA年度认证大V主播 · 治愈赛道', 'LUMA平台认证人气主播 · 暖心陪伴'],
    fanClubPool: ['暖阳小筑', '蜜糖小屋', '星语心愿'],
    tagsPool: ['#治愈系', '#温柔电台', '#深夜陪伴', '#暖心互动', '#睡前故事', '#晚安电台']
  },
  tech: {
    keywords: ['赛博', '科技', '机械', '未来', '虚拟', '数据', '芯片', '电子', '歌姬', 'AI', '星舰'],
    bioPool: ['来自赛博星云的低语，数据流里为你亮灯。', '代码写不出心跳，但直播间可以。', '穿越数据洪流，只为今晚见你。'],
    verifyPool: ['LUMA年度认证大V主播 · 次元科技赛道', 'LUMA平台认证人气主播 · 未来之声'],
    fanClubPool: ['量子脉冲', '霓虹数据', '星环协议'],
    tagsPool: ['#赛博歌姬', '#虚拟偶像', '#电子音乐', '#未来之声', '#数据幻境', '#深夜电波']
  },
  cute: {
    keywords: ['可爱', '萌', '元气', '活泼', '萝莉', '甜妹', '俏皮', '治愈系'],
    bioPool: ['元气满满营业中，今天也要开心呀！', '可可爱爱没有脑袋，只会唱歌跳舞。', '小太阳本阳，把好心情传染给你！'],
    verifyPool: ['LUMA年度认证大V主播 · 元气赛道', 'LUMA平台认证人气主播 · 青春活力'],
    fanClubPool: ['糖果星球', '元气补给站', '奶糖作坊'],
    tagsPool: ['#元气少女', '#可可爱爱', '#唱歌跳舞', '#快乐星球', '#今日份甜', '#活力日常']
  },
  elegant: {
    keywords: ['古风', '舞', '仙', '雅', '琴', '国风', '汉服', '古筝'],
    bioPool: ['一袭清欢，舞动人间烟火。', '抚琴听雨，把古韵唱给你听。', '罗衣飘飘，半阙清歌寄相思。'],
    verifyPool: ['LUMA年度认证大V主播 · 国风艺术赛道', 'LUMA平台认证人气主播 · 古典雅韵'],
    fanClubPool: ['青鸾阁', '云锦坊', '烟雨楼'],
    tagsPool: ['#国风舞蹈', '#古典舞', '#汉服日常', '#古筝弹唱', '#仙气飘飘', '#传统文化']
  },
  lively: {
    keywords: ['搞笑', '幽默', '段子', '脱口秀', '逗', '整活', '话痨', '欢乐'],
    bioPool: ['全网最严肃的搞笑主播，笑死不偿命。', '人形段子生成器，快乐源泉本泉。', '进直播间记得放下水杯，笑喷不赔。'],
    verifyPool: ['LUMA年度认证大V主播 · 娱乐赛道', 'LUMA平台认证人气主播 · 快乐制造机'],
    fanClubPool: ['快乐制造局', '爆笑补给站', '段子手联盟'],
    tagsPool: ['#搞笑博主', '#人间清醒', '#连麦整活', '#段子手', '#快乐源泉', '#嘴瓢日常']
  }
};

// 世界观 → IP 属地候选池（本地规则）
const PROFILE_IP_POOL = {
  tech: ['赛博星云-新京都', '数据之都-零号城', '霓虹港-东区', '量子深海城'],
  fantasy: ['云梦泽', '昆仑墟', '蓬莱仙岛', '长安旧梦'],
  modern: ['上海', '北京', '深圳', '杭州', '成都', '广州'],
  default: ['上海', '北京', '广东', '浙江', '四川', '东京']
};

// 字符串 → 稳定 hash（同一角色每次生成一致）
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 从候选池取 n 个不重复项（基于 hash 种子）
function pickDistinct(arr, seed, n) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice((seed + i * 7) % copy.length, 1)[0]);
  }
  return out;
}

// 人设文本 → 风格 key 列表（按命中关键词数排序）
function detectProfileStyle(fullText) {
  const scores = [];
  for (const key of Object.keys(PROFILE_STYLE_LIBRARY)) {
    let hit = 0;
    for (const kw of PROFILE_STYLE_LIBRARY[key].keywords) {
      if (fullText.includes(kw)) hit++;
    }
    if (hit > 0) scores.push({ key, hit });
  }
  scores.sort((a, b) => b.hit - a.hit);
  return scores.map(s => s.key);
}

// 世界书文本 → 世界观主题（决定 IP 属地风格）
function detectWorldTheme(worldText) {
  if (!worldText) return 'modern';
  if (/(赛博|科技|机械|未来|AI|数据|虚拟|电子|芯片|星舰|网络|数码|量子)/.test(worldText)) return 'tech';
  if (/(古风|仙侠|剑|江湖|汉服|大唐|修仙|玄幻|异界|龙|仙)/.test(worldText)) return 'fantasy';
  return 'modern';
}

// 本地规则生成档案五项（不调 API，瞬时完成）
async function generateProfileLocalSettings(characterId) {
  try {
    // 1. SDK 读取角色人设（与直播间显示头像名字同源的读取方式）
    let persona = '';
    try {
      if (api.characters && typeof api.characters.get === 'function') {
        const full = await api.characters.get(characterId);
        persona = full?.persona || full?.description || '';
      }
    } catch (e) {}
    const charObj = (window.allCharacters || []).find(c => c.id === characterId);
    const charName = charObj?.name || '主播';

    // 2. SDK 读取世界书（世界观）
    let worldText = '';
    try {
      if (api.world && typeof api.world.list === 'function') {
        const entries = await api.world.list();
        if (entries && entries.length) {
          worldText = entries.slice(0, 3)
            .map(en => `${en?.title || ''} ${en?.content || en?.text || ''}`)
            .join(' ').slice(0, 600);
        }
      }
    } catch (e) {}

    // 3. 本地规则匹配：人设 → 风格，世界观 → IP 属地
    const fullText = `${charName} ${persona}`;
    const styleKeys = detectProfileStyle(fullText);
    const theme = detectWorldTheme(worldText);
    const seed = hashStr(characterId);

    const primary = styleKeys.length ? PROFILE_STYLE_LIBRARY[styleKeys[0]] : null;
    const fallback = STREAMER_PERSONA_PRESETS.find(p => p.keywords.some(k => fullText.includes(k)))
      || STREAMER_PERSONA_PRESETS[STREAMER_PERSONA_PRESETS.length - 1];

    const settings = {
      bio: primary ? pickDistinct(primary.bioPool, seed, 1)[0] : fallback.bio,
      verifyTitle: primary ? pickDistinct(primary.verifyPool, seed >> 3, 1)[0] : `LUMA 平台年度认证大V主播 · ${fallback.category}`,
      ipLocation: pickDistinct(PROFILE_IP_POOL[theme] || PROFILE_IP_POOL.default, seed >> 1, 1)[0],
      fanClubPrefix: primary ? pickDistinct(primary.fanClubPool, seed >> 2, 1)[0] : fallback.fanClub,
      tags: primary ? pickDistinct(primary.tagsPool, seed, 4) : fallback.tags
    };
    if (settings.tags.length < 4) {
      const defaultTags = ['#签约主播', '#人气新星', '#直播日常', '#互动达人'];
      while (settings.tags.length < 4) {
        settings.tags.push(defaultTags[settings.tags.length]);
      }
    }
    return settings;
  } catch (e) {
    console.warn('[LUMA] 本地档案生成异常，使用兜底初始值:', e);
    return null;
  }
}
window.generateProfileLocalSettings = generateProfileLocalSettings;

function applyProfileSettings(profile, settings) {
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

  // 读取档案：编辑存档 > 本地规则生成存档 > 首次打开本地生成（失败回退兜底预设）
  try {
    const saved = await api.db.get('streamer_profile_edits', profile.characterId).catch(() => null);
    if (saved) {
      if (saved.verifyTitle) profile.verifyTitle = saved.verifyTitle;
      if (saved.bio) profile.bio = saved.bio;
      if (saved.ipLocation) profile.ipLocation = saved.ipLocation;
      if (saved.fanClubName) profile.fanClubName = saved.fanClubName;
      if (Array.isArray(saved.tags) && saved.tags.length) profile.tags = saved.tags;
    } else {
      const cached = await api.db.get('streamer_profile_local', profile.characterId).catch(() => null);
      if (cached && cached.settings) {
        applyProfileSettings(profile, cached.settings);
      } else {
        // 首次打开：SDK 读取人设+世界书 → 本地规则瞬时生成，缓存后应用
        const settings = await generateProfileLocalSettings(profile.characterId);
        if (settings) {
          applyProfileSettings(profile, settings);
          api.db.create('streamer_profile_local', { id: profile.characterId, settings, time: Date.now() }).catch(() => {});
        }
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
// Tab 切换（动态 Tab 保留，随机内容已清空显示空态）
// -------------------------------------------------------------------------
function switchSpTab(tab) {
  window.activeSpTab = tab;
  const tabs = ['posts', 'shows', 'gallery', 'guestbook'];
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

  if (tab === 'posts') renderSpPosts();
  else if (tab === 'shows') renderSpShows();
  else if (tab === 'gallery') renderSpGallery();
  else if (tab === 'guestbook') renderSpGuestbook();
}
window.switchSpTab = switchSpTab;

// 动态面板：随机内容已全部清空，显示空态占位（等社区真实功能接入）
function renderSpPosts() {
  const box = document.getElementById('spPanelPosts');
  if (!box || !window.currentViewingProfile) return;
  box.innerHTML = `
    <div class="py-16 flex flex-col items-center justify-center text-center">
      <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
        <svg class="w-6 h-6 text-slate-300 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
      </div>
      <p class="text-xs text-slate-400 font-medium">主播还没有发布动态</p>
      <p class="text-[10px] text-slate-300 mt-1">动态功能准备中，敬请期待</p>
    </div>
  `;
}

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
