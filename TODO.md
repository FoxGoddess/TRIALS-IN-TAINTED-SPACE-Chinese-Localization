# 待办事项 / 已知问题

## 需要解决的技术问题
- [ ] `main.93039f77.js`文件 60+MB 无法启用 GitLens 行内时间戳，需要寻找替代方案

- [ ] 角色创建 皮肤选择页面按钮难以汉化，疑似无文本。

  尝试了生成新代码来达成汉化效果，代码已跑通但是因进度不足无法对后续获取肤色文本内容项目进行测试

  ```js
  function Tw() {
    // ========== 肤色选项（中文显示名 / 内部英文值） ==========
    // 这里覆盖了《TiTS》中常见的所有肤色，可按需增删
    var skinColorOptions = [
      ["苍白", "pale"],
      ["白皙", "fair"],
      ["小麦色", "tan"],
      ["粉色", "pink"],
      ["深红", "dark red"],
      ["深绿", "dark green"],
      ["灰色", "gray"],
      ["黑色", "black"],
      ["乌木色", "ebony"],
      ["白色", "white"],
      ["橄榄色", "olive"],
      ["棕色", "brown"],
      ["黄色", "yellow"],
      ["橙色", "orange"],
      ["蓝色", "blue"],
      ["红色", "red"],
      ["绿色", "green"],
      ["紫色", "purple"],
      ["金色", "gold"],
      ["银色", "silver"]
    ];
  
    // 根据角色种族过滤肤色（保持原逻辑）
    var allowedSet;
    if ("half-gryvain" === pc.originalRace) {
      // 半 gryvain 只允许：pale, tan, pink, dark red, dark green
      allowedSet = new Set(["pale", "tan", "pink", "dark red", "dark green"]);
    } else if ("half-leithan" === pc.originalRace) {
      // 半 leithan 只允许：pale, fair, gray, black
      allowedSet = new Set(["pale", "fair", "gray", "black"]);
    } else {
      allowedSet = null; // 其他种族允许全部
    }
  
    var filteredOptions = allowedSet
      ? skinColorOptions.filter(function (pair) { return allowedSet.has(pair[1]); })
      : skinColorOptions.slice();
  
    // ========== 开始绘制界面 ==========
    clearOutput();
    uw(true);
    output(blockHeader("肤色")); // 原 "Skin Pigment"
    output("<i>“很好。那肤色呢？”</i>"); // 原 "Great. How about skin pigmentation?"
    output("\n\n<b>你角色的皮肤是什么颜色？</b>"); // 原 "What color is your character's skin?"
    clearMenu();
  
    // 生成肤色按钮
    filteredOptions.forEach(function (pair, index) {
      var displayName = pair[0];
      var colorValue = pair[1];
      addButton(index, displayName, function () {
        // ---- 以下所有逻辑与原版一致，只改动显示文本 ----
        pc.skinTone = colorValue;
        if (pc.hasCock() && pc.cocks[0].cType === GLOBAL.TYPE_HUMAN) {
          pc.cocks[0].cockColor = (colorValue === "dark" || colorValue === "ebony") ? "ebony" : "pink";
        }
        if ("half-suula" === pc.originalRace) {
          if (pc.hasVagina()) {
            if (["pale", "fair", "tan"].includes(pc.skinTone)) {
              pc.vaginas[0].vaginaColor = "amber";
              pc.nippleColor = "amber";
            } else if ("ebony" === pc.skinTone) {
              pc.vaginas[0].vaginaColor = "sable";
              pc.nippleColor = "sable";
            } else {
              pc.vaginas[0].vaginaColor = "blue";
              pc.nippleColor = "blue";
            }
          } else {
            if (["pale", "fair", "tan"].includes(pc.skinTone)) {
              pc.cocks[0].cockColor = "amber";
              pc.nippleColor = "amber";
            } else if ("ebony" === pc.skinTone) {
              pc.cocks[0].cockColor = "sable";
              pc.nippleColor = "sable";
            } else {
              pc.cocks[0].cockColor = "blue";
              pc.nippleColor = "blue";
            }
          }
        }
  
        // 半 suula 需要继续选择鳞片颜色，否则进入下一步
        if (["half-suula"].includes(pc.originalRace)) {
          // 鳞片颜色界面
          (function () {
            clearOutput();
            uw(true);
            output(blockHeader("鳞片颜色")); // 原 "Scale Pigment"
            output("<i>“不错。那鳞片颜色呢？”</i>"); // 原 "Nice. Now how about the scale color?"
            output("\n\n<b>你角色的鳞片将是什么颜色？</b>"); // 原 "What will your character's scale color be?"
            clearMenu();
            var scaleOptions = [
              ["蓝色", "blue"],   // 原 "Blue"
              ["红色", "red"],    // 原 "Red"
              ["绿色", "green"],  // 原 "Green"
              ["紫色", "purple"], // 原 "Purple"
              ["金色", "gold"],   // 原 "Gold"
              ["银色", "silver"]  // 原 "Silver"
            ];
            scaleOptions.forEach(function (scalePair, i) {
              addButton(i, scalePair[0], function () {
                pc.scaleColor = scalePair[1];
                Cw();
              });
            });
            addButton(14, "返回", Tw); // 原 "Back"
          })();
        } else {
          Cw();
        }
      });
    });
  
    // 返回按钮（保证不被肤色按钮覆盖）
    var backIndex = filteredOptions.length >= 14 ? 14 : filteredOptions.length;
    addButton(backIndex, "返回", "half-gryvain" === pc.originalRace ? ww : Aw); // 原 "Back"
  }
  ```

  代码非最终版，依旧可以优化，暂不使用，待整体基本汉化完成后在进行更替代码测试。

  

- [ ] 空白
## 翻译质量需要复查的段落
- [ ] `main.93039f77.js` 中 “Cockvine” 最终确定为“阳藤”，需全局搜索确认是否有遗漏
- [ ] 空白

## 游戏内无法测试到的场景
- [ ] 某些种族的特殊交互文本（如 Leithan 的六足移动描述）因进度不足无法触发测试
- [ ] 空白