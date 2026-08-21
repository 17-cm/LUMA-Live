// 测试文件：用于验证 fetch + eval 在小手机沙盒里是否可行
console.log("========================================");
console.log("✅ 测试成功！eval 可以在沙盒里运行！");
console.log("========================================");
console.log("当前时间:", new Date().toLocaleString());
console.log("window 对象存在:", typeof window !== "undefined");
console.log("document 对象存在:", typeof document !== "undefined");

// 测试能不能修改 DOM
if (typeof document !== "undefined") {
  const testDiv = document.createElement("div");
  testDiv.id = "eval-test-success";
  testDiv.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:20px;border-radius:10px;z-index:99999;font-size:16px;font-weight:bold;";
  testDiv.textContent = "✅ eval 测试成功！";
  document.body.appendChild(testDiv);
  console.log("✅ DOM 修改成功！页面上应该出现绿色提示框");
  
  // 3秒后自动移除
  setTimeout(() => {
    if (testDiv.parentNode) {
      testDiv.parentNode.removeChild(testDiv);
    }
  }, 3000);
}

window.__evalTestSuccess = true;
