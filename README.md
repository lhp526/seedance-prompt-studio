# Seedance 2.5 Prompt Archive

一个可直接部署的双语 Seedance 2.5 视频提示词资料库，包含 24 个完整案例，支持：

- 中英双语提示词切换
- 全文搜索与分类筛选
- 一行复制提示词
- 移动端适配
- 提示词 JSON 下载
- 案例封面、画幅比例与参考素材数量展示
- 独立提示词深链接

## 在线地址

https://lhp526.github.io/seedance-prompt-studio/

## 本地预览

```powershell
python -m http.server 4173
```

打开 `http://localhost:4173/`。

## 数据重建

数据源为 [kinovi-ai/awesome-seedance-2-5-prompts](https://github.com/kinovi-ai/awesome-seedance-2-5-prompts)。仓库同级目录需存在浅克隆文件夹 `_deploy_seedance_prompts_20261028`，然后运行：

```powershell
python scripts/build_prompt_data.py
```

脚本会生成：

- `assets/js/prompts.js`
- `assets/data/prompts.json`
- `assets/images/*`

## 内容与许可

提示词、示例图片和原始案例内容来自 kinovi.ai 的开源项目，遵循 MIT License。本站保留来源链接与许可声明，未改变原始提示词内容。