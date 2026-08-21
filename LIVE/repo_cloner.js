// =========================================================================
// LUMA Live 仓库克隆器
// 从 GitHub 拉取整个仓库的文件，存储到 api.db
// 就像 git clone 一样，把整个仓库克隆到本地数据库
// =========================================================================

(function() {
  'use strict';

  const GITHUB_OWNER = '17-cm';
  const GITHUB_REPO = 'LUMA-Live';
  const GITHUB_BRANCH = 'test';

  // 获取 GitHub API 基础 URL
  function getGithubApiBase() {
    return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
  }

  // 获取 raw 文件基础 URL
  function getRawBase() {
    return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;
  }

  // 获取最新 commit hash
  async function getLatestCommitHash() {
    try {
      const url = `${getGithubApiBase()}/commits/${GITHUB_BRANCH}`;
      console.log('[RepoCloner] 获取最新 commit:', url);
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const hash = data.sha;
      console.log('[RepoCloner] 最新 commit hash:', hash);
      return hash;
    } catch (err) {
      console.error('[RepoCloner] 获取最新 commit 失败:', err);
      throw err;
    }
  }

  // 获取仓库文件树（递归）
  async function getRepoFileTree() {
    try {
      const url = `${getGithubApiBase()}/git/trees/${GITHUB_BRANCH}?recursive=1`;
      console.log('[RepoCloner] 获取文件树:', url);
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const files = data.tree.filter(item => item.type === 'blob');
      console.log('[RepoCloner] 获取到文件数量:', files.length);
      return files;
    } catch (err) {
      console.error('[RepoCloner] 获取文件树失败:', err);
      throw err;
    }
  }

  // 下载单个文件内容
  async function downloadFile(filepath) {
    try {
      const url = `${getRawBase()}/${filepath}`;
      console.log('[RepoCloner] 下载文件:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${filepath}`);
      }
      
      const content = await response.text();
      console.log('[RepoCloner] 下载成功:', filepath, '大小:', content.length, '字符');
      return content;
    } catch (err) {
      console.error('[RepoCloner] 下载文件失败:', filepath, err);
      throw err;
    }
  }

  // 克隆整个仓库到 api.db
  async function cloneRepoToDb(progressCallback) {
    try {
      console.log('[RepoCloner] 开始克隆仓库...');
      
      // 1. 获取最新 commit hash
      if (progressCallback) progressCallback('正在获取最新版本信息...', 0);
      const commitHash = await getLatestCommitHash();
      
      // 2. 获取文件树
      if (progressCallback) progressCallback('正在获取文件列表...', 10);
      const files = await getRepoFileTree();
      
      // 3. 过滤掉不需要的文件（.git、.github、README 等）
      const filteredFiles = files.filter(file => {
        const path = file.path.toLowerCase();
        return !path.startsWith('.git') && 
               !path.startsWith('.github') && 
               !path.endsWith('.md') &&
               !path.endsWith('.zip');
      });
      
      console.log('[RepoCloner] 需要下载的文件数量:', filteredFiles.length);
      
      // 4. 逐个下载文件并存储到 api.db
      const totalFiles = filteredFiles.length;
      let downloadedCount = 0;
      const failedFiles = [];
      
      for (const file of filteredFiles) {
        try {
          if (progressCallback) {
            const percent = Math.round(10 + (downloadedCount / totalFiles) * 80);
            progressCallback(`正在下载: ${file.path}`, percent);
          }
          
          const content = await downloadFile(file.path);
          
          // 存储到 api.db
          await saveFileToDb(file.path, content, commitHash);
          
          downloadedCount++;
        } catch (err) {
          console.warn('[RepoCloner] 文件下载失败，跳过:', file.path, err);
          failedFiles.push(file.path);
        }
      }
      
      // 5. 记录当前版本
      if (progressCallback) progressCallback('正在保存版本信息...', 95);
      await saveCurrentVersion(commitHash, downloadedCount, new Date().toISOString());
      
      if (progressCallback) progressCallback('克隆完成！', 100);
      
      console.log('[RepoCloner] 克隆完成！成功:', downloadedCount, '失败:', failedFiles.length);
      if (failedFiles.length > 0) {
        console.warn('[RepoCloner] 失败的文件:', failedFiles);
      }
      
      return {
        success: true,
        commitHash,
        downloadedCount,
        failedCount: failedFiles.length,
        failedFiles
      };
    } catch (err) {
      console.error('[RepoCloner] 克隆仓库失败:', err);
      if (progressCallback) progressCallback(`克隆失败: ${err.message}`, 100);
      return {
        success: false,
        error: err.message
      };
    }
  }

  // 保存单个文件到 api.db
  async function saveFileToDb(filepath, content, commitHash) {
    try {
      const fileData = {
        id: filepath,
        filename: filepath,
        content: content,
        commit_hash: commitHash,
        updated_at: new Date().toISOString()
      };
      
      // 先尝试创建，失败则更新
      try {
        await api.db.create('app_files', fileData);
      } catch (e) {
        await api.db.update('app_files', filepath, {
          content: content,
          commit_hash: commitHash,
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[RepoCloner] 保存文件到 db 失败:', filepath, err);
      throw err;
    }
  }

  // 保存当前版本信息
  async function saveCurrentVersion(commitHash, fileCount, updatedAt) {
    try {
      const versionData = {
        id: 'current',
        commit_hash: commitHash,
        file_count: fileCount,
        updated_at: updatedAt
      };
      
      try {
        await api.db.create('app_version', versionData);
      } catch (e) {
        await api.db.update('app_version', 'current', versionData);
      }
    } catch (err) {
      console.error('[RepoCloner] 保存版本信息失败:', err);
    }
  }

  // 获取当前版本信息
  async function getCurrentVersion() {
    try {
      const version = await api.db.get('app_version', 'current');
      return version;
    } catch (err) {
      console.log('[RepoCloner] 获取当前版本失败（可能是第一次启动）:', err);
      return null;
    }
  }

  // 检查是否有更新
  async function checkForUpdate() {
    try {
      const currentVersion = await getCurrentVersion();
      const latestHash = await getLatestCommitHash();
      
      if (!currentVersion) {
        return {
          hasUpdate: true,
          isFirstRun: true,
          currentHash: null,
          latestHash
        };
      }
      
      return {
        hasUpdate: currentVersion.commit_hash !== latestHash,
        isFirstRun: false,
        currentHash: currentVersion.commit_hash,
        latestHash
      };
    } catch (err) {
      console.error('[RepoCloner] 检查更新失败:', err);
      return {
        hasUpdate: false,
        error: err.message
      };
    }
  }

  // 从 api.db 读取文件内容
  async function getFileFromDb(filepath) {
    try {
      const file = await api.db.get('app_files', filepath);
      return file ? file.content : null;
    } catch (err) {
      console.error('[RepoCloner] 从 db 读取文件失败:', filepath, err);
      return null;
    }
  }

  // 列出 api.db 里的所有文件
  async function listAllFiles() {
    try {
      const files = await api.db.list('app_files');
      return files || [];
    } catch (err) {
      console.error('[RepoCloner] 列出文件失败:', err);
      return [];
    }
  }

  // 暴露到全局
  window.RepoCloner = {
    cloneRepoToDb,
    getLatestCommitHash,
    getCurrentVersion,
    checkForUpdate,
    getFileFromDb,
    listAllFiles
  };

  console.log('[RepoCloner] 仓库克隆器已加载');
})();
