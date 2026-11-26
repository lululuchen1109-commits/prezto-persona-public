'use strict';

// Content summaries provide task evidence, not inferred occupations or adoption.
const contentDefaults={query:'',purpose:'all',payment:'all',repeat:'all',action:'all',user:'',account:'all',cohort:'all',task:''};
const contentUI={...contentDefaults,data:null,initialized:false,sort:'recent',page:1,size:25,mode:'chart'};
const contentCohorts={repay:'付款至少 2 笔',repeatDays:'跨日创建任务',bothActions:'两种后续动作均有记录',mentionsBoth:'摘要提及两种格式',mentionsForward:'先提小红书、后提小绿书',mentionsReverse:'先提小绿书、后提小红书'};
function contentURLFilters(params){for(const [key,defaultValue] of Object.entries(contentDefaults)){const value=contentUI[key];if(value&&value!==defaultValue)params.set(key==='query'?'q':key,value);}return params;}
function contentInitialFilters(){if(contentUI.initialized)return;contentUI.initialized=true;const p=new URLSearchParams(location.search);if(p.get('view')!=='content')return;for(const k of Object.keys(contentDefaults)){const v=p.get(k==='query'?'q':k);if(v&&v.length<250)contentUI[k]=v;}if(contentUI.user)state.contentUser=contentUI.user;if(contentUI.action==='handoff')contentUI.action='xhs_handoff';if(contentUI.action==='draft')contentUI.action='oa_draft_synced';if(contentUI.repeat==='repeat')contentUI.repeat='multiple';if(contentUI.purpose==='unidentified')contentUI.purpose='unknown';}
function contentArray(v){return Array.isArray(v)?v:[];}
function contentKnown(v){return typeof v==='number'&&Number.isFinite(v);}
function contentNumber(v){return contentKnown(v)?fmt(v):'未提供';}
function contentPercent(v){return contentKnown(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:1})+'%':'未提供';}
function contentDate(v){return v?stamp(v):'未记录';}
function contentRatio(n,d){return contentKnown(n)&&contentKnown(d)&&d>0?100*n/d:null;}
function contentURL(){return null;}

function contentSource(t){return `<a href="?view=content&amp;task=${encodeURIComponent(t.id)}">查看公开任务记录</a>`;}

function contentProfile(t){return contentUI.data?.profiles?.[t.user_key]||{};}
function contentPayment(t){
  const p=contentProfile(t),status=t.payment_status??p.payment_status;
  if(['paid','no_payment','unlinked'].includes(status))return status;
  const paid=t.paid??p.paid;if(paid===true)return 'paid';if(paid===false)return 'no_payment';return 'unlinked';
}
function contentPaymentLabel(t){return {paid:'有付款记录',no_payment:'当前订单无付款',unlinked:'付款身份未连接'}[contentPayment(t)];}
function contentTaskCount(t){const count=contentProfile(t).task_count;return contentKnown(count)?count:contentArray(contentUI.data?.tasks).filter(x=>x.user_key===t.user_key).length;}
function contentIdentity(t){
  const label=t.name&&t.name!=='未填写昵称'?t.name:'用户 '+(t.user_id||'身份未提供');
  return `<div class="content-identity">${t.snapshot_key?`<button class="user-button" data-user="${esc(t.snapshot_key)}">${esc(label)}</button>`:`<strong>${esc(label)}</strong>`}${t.source_test_tag?'<small>来源标记：测试账号</small>':''}<span>匿名内容账号</span><span>${esc(contentPaymentLabel(t))}${t.payment_orders>0?' · '+contentNumber(t.payment_orders)+' 笔':''}</span><button type="button" class="text-button" data-content-user="${esc(t.user_key)}">本批 ${contentNumber(contentTaskCount(t))} 个任务</button>${!t.in_registered?'<small>未连接可见注册记录</small>':''}</div>`;
}
function contentLabels(t){
  const labels=contentArray(t.labels).filter(l=>l.id!=='unknown');
  if(!labels.length)return '<span class="content-muted">未识别用途</span>';
  return `<div class="content-labels">${labels.map(l=>`<button type="button" data-content-purpose="${esc(l.id)}">${esc(l.label)}</button>`).join('')}</div><details class="content-match"><summary>查看匹配依据</summary><p>根据来源摘要命中用途词表。</p><blockquote>${esc(t.summary)}</blockquote></details>`;
}

function contentActions(t){
  const flags=t.source_flags||{},items=[];
  if(flags.xhs_handoff===true)items.push('已记录小红书交接');
  if(flags.oa_draft_synced===true)items.push('公众号草稿已同步');
  return `<div class="content-task-actions">${items.length?items.map(s=>`<span>${esc(s)}</span>`).join(''):'<span class="content-muted">未记录交接或草稿同步</span>'}${flags.xhs_label?`<small>小红书阶段：${esc(flags.xhs_label)}</small>`:''}${flags.oa_label?`<small>公众号阶段：${esc(flags.oa_label)}</small>`:''}${items.length?'<small>不代表正式发布或实际采用</small>':''}</div>`;
}
function contentTaskSummary(t){
  const summary=String(t.summary||'');
  if(!summary.trim())return '<p class="content-summary-empty">此任务没有返回摘要；用途保持未识别。</p>';
  if(summary.length<=180)return `<p class="content-task-summary">${esc(summary)}</p>`;
  return `<details class="content-summary-expand"><summary><span>${esc(summary.slice(0,180))}…</span><small>展开来源摘要</small></summary><p class="content-task-summary">${esc(summary)}</p></details>`;
}
function contentInputs(){return '';}

function contentTaskRow(t){
  return `<tr><td><div class="content-task-meta"><span>任务 #${esc(t.id)}</span><span>创建 ${esc(contentDate(t.created_at))}</span></div>${contentTaskSummary(t)}${contentInputs(t)}<div class="content-task-source">${contentSource(t)}<span>${t.detail_available?'已读取部分详情':'当前仅有汇总'}</span></div></td><td>${contentIdentity(t)}</td><td>${contentLabels(t)}</td><td>${contentActions(t)}<small class="content-last-record">最近对话时间和消息数仅在本机可见</small></td></tr>`;
}
function contentFiltered(){
  const terms=contentUI.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const rows=contentArray(contentUI.data?.tasks).filter(t=>{
    if(contentUI.account==='excludeTest'&&t.source_test_tag)return false;if(contentUI.account==='sourceTest'&&!t.source_test_tag)return false;
    if(contentUI.user&&t.user_key!==contentUI.user&&String(t.user_id)!==contentUI.user)return false;
    if(contentUI.task&&String(t.id)!==contentUI.task&&String(t.task_id)!==contentUI.task)return false;
    if(contentUI.cohort!=='all'&&!contentUI.groups?.[contentUI.cohort]?.has(t.user_key))return false;
    if(contentUI.purpose!=='all'&&!contentArray(t.labels).some(l=>l.id===contentUI.purpose))return false;
    if(contentUI.payment!=='all'&&contentPayment(t)!==contentUI.payment)return false;
    if(contentUI.repeat==='multiple'&&contentTaskCount(t)<2)return false;
    if(contentUI.repeat==='single'&&contentTaskCount(t)!==1)return false;
    if(contentUI.action!=='all'&&t.source_flags?.[contentUI.action]!==true)return false;
    const text=[t.search_text,t.summary,t.user_id,t.code,t.name,t.task_id,t.id,...contentArray(t.labels).map(l=>l.label),...contentArray(t.user_inputs).map(m=>m.text)].join(' ').toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  });
  const byDate=(a,b)=>0;
  rows.sort((a,b)=>contentUI.sort==='tasks'?contentTaskCount(b)-contentTaskCount(a)||byDate(a,b):contentUI.sort==='created'?String(b.created_at||'').localeCompare(String(a.created_at||'')):byDate(a,b));
  return rows;
}
function contentPurposeRows(d){
  return contentArray(d.purposes).map(p=>({...p,label:p.id==='unknown'?'未识别用途':p.label})).sort((a,b)=>(a.id==='unknown')-(b.id==='unknown')||b.task_count-a.task_count);
}
function contentPurposes(d){
  const rows=contentPurposeRows(d);
  if(contentUI.mode==='table')return `<div class="content-purpose-table" tabindex="0" aria-label="用途匹配分布数据表"><table><thead><tr><th scope="col">摘要规则标签</th><th scope="col">任务数</th><th scope="col">占全部任务</th><th scope="col">去重用户数</th><th scope="col">占全部内容用户</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row"><button type="button" data-content-purpose="${esc(r.id)}">${esc(r.label)}</button></th><td>${contentNumber(r.task_count)}</td><td>${contentPercent(r.task_percent)}</td><td>${r.unidentified?'—':contentNumber(r.user_count)}</td><td>${r.unidentified?'—':contentPercent(r.user_percent)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<div class="content-purpose-bars" role="group" aria-label="摘要用途匹配，各条分母为本批全部任务，标签可重叠">${rows.map(r=>`<button type="button" class="content-purpose-row ${r.unidentified?'is-unidentified':''}" data-content-purpose="${esc(r.id)}" aria-pressed="${contentUI.purpose===r.id}"><span>${esc(r.label)}</span><span class="content-purpose-track" aria-hidden="true"><i style="width:${contentKnown(r.task_percent)?Math.max(0,Math.min(100,r.task_percent)):0}%"></i></span><b>${contentNumber(r.task_count)} <small>个</small></b><span class="content-purpose-percent">${contentPercent(r.task_percent)}</span><small class="content-purpose-users">${r.unidentified?'保持未分类':contentNumber(r.user_count)+' 人'}</small></button>`).join('')}</div>`;
}
function contentCoverage(d){
  const s=d.summary||{},matched=contentRatio(s.matched_purpose_tasks,s.tasks),flags=d.source_flags||{};
  const detailTasks=s.tasks_with_saved_user_inputs;
  return `<aside class="content-coverage"><h2>这些结论覆盖了哪里</h2><div class="content-coverage-line"><span>摘要可匹配用途</span><b>${contentNumber(s.matched_purpose_tasks)} / ${contentNumber(s.tasks)} 个任务</b></div><div class="content-coverage-track" role="img" aria-label="摘要匹配覆盖 ${contentPercent(matched)}"><i style="width:${contentKnown(matched)?Math.max(0,Math.min(100,matched)):0}%"></i></div><p>${contentNumber(s.unidentified_tasks)} 个任务未识别；${contentNumber(s.tasks_missing_summary)} 个没有摘要。关键词没有命中，不代表用户没有用途。</p><dl><div><dt>连接可见注册记录</dt><dd>${contentNumber(s.matched_registered_users)} / ${contentNumber(s.users)} 人</dd></div><div><dt>连接业务快照身份</dt><dd>${contentNumber(s.matched_snapshot_users)} / ${contentNumber(s.users)} 人</dd></div><div><dt>已读取详情</dt><dd>${contentNumber(detailTasks)} / ${contentNumber(s.tasks)} 个任务</dd></div></dl><p>未关联用户保留在内容分母内。已读取详情只覆盖部分任务，不能据此外推全部工作流程。</p><div class="content-observed-actions"><h3>确有记录的后续动作</h3><button type="button" data-content-action="xhs_handoff"><b>${contentNumber(flags.xhs_handoff?.tasks)}</b><span>个任务有小红书交接<br><small>${contentNumber(flags.xhs_handoff?.users)} 名用户</small></span></button><button type="button" data-content-action="oa_draft_synced"><b>${contentNumber(flags.oa_draft_synced?.tasks)}</b><span>个任务同步公众号草稿<br><small>${contentNumber(flags.oa_draft_synced?.users)} 名用户</small></span></button><p>交接和草稿同步不是正式发布，也不能直接认定内容被采用。</p></div></aside>`;
}
function contentDistribution(d){
  return `<details class="content-method content-distribution"><summary>查看任务重复程度与统计口径</summary><div class="content-distribution-grid"><div><h3>本批每位用户有几个任务</h3><p>分母 ${contentNumber(d.summary?.users)} 人，互斥分组。任务创建不等于成功交付。</p>${contentArray(d.task_distribution).map(r=>`<div class="content-mini-row"><span>${esc(r.label)}</span><b>${contentNumber(r.count)} 人</b><span>${contentPercent(r.percent)}</span></div>`).join('')}</div><div><h3>记录出现在多少个日期</h3><p>${esc(d.observed_days?.basis||'仅使用本批返回的可见记录日期')}</p>${contentArray(d.observed_days?.buckets).map(r=>`<div class="content-mini-row"><span>${esc(r.label)}</span><b>${contentNumber(r.count)} 人</b><span>${contentPercent(r.percent)}</span></div>`).join('')}<p>${contentArray(d.observed_days?.limits).map(esc).join(' ')}</p></div></div><ul><li>用途按摘要关键词匹配；同一任务可命中多个标签，标签人数也可重叠，不能累加为总人数。</li><li>标签描述任务线索，不证明用户的行业、职业、真实动机或产物已经被采用。</li><li>${esc(d.output_diversity?.reason||'摘要中同时出现小红书、小绿书不能证明真实多格式产出或跨格式转换。')}</li><li>摘要中的原话与步骤由维护者在原始会话核对。</li></ul></details>`;
}
function contentGroupIndex(d){
  return Object.fromEntries(Object.keys(contentCohorts).map(k=>[k,new Set(d.groups?.[k]||[])]));
}

function contentWorkBrief(d){
  const tasks=contentArray(d.tasks),purposes=contentArray(d.purposes);
  const examples=[
    ['social','做社媒内容','小红书|公众号','交接后是否需要改标题、重排图片，才能发布？'],
    ['learning','准备教学或学习材料','教学|课件|职业规划|答辩','产物是给自己学习、拿去授课，还是作为作业提交？'],
    ['reporting','准备汇报材料','汇报|述职|工作总结','哪些页可直接用于汇报，哪些仍要回到演示工具修改？']
  ].map(([id,title,pattern,follow])=>{
    const p=purposes.find(x=>x.id===id);if(!p?.task_count)return '';
    const matches=tasks.filter(t=>contentArray(t.labels).some(l=>l.id===id));const source=matches.find(t=>new RegExp(pattern).test(t.summary))||matches.find(t=>t.summary.startsWith('任务主题'))||matches[0];
    return `<article><h3>${esc(title)}</h3><button type="button" class="text-button" data-content-purpose="${id}">${contentNumber(p.user_count)} 人 · ${contentNumber(p.task_count)} 个相关任务 →</button>${source?`<blockquote>${esc(source.summary.slice(0,100))}${source.summary.length>100?'…':''}</blockquote><button type="button" class="text-button" data-content-task="${esc(source.id)}">核对任务 #${esc(source.id)}</button>`:''}<p><b>值得追问：</b>${esc(follow)}</p></article>`;
  }).filter(Boolean);
  const gr=contentUI.groups;const paid=gr.repay.size,days=gr.repeatDays.size;
  return `<section class="content-brief" aria-label="真实工作与优先跟进"><h2>用户带来了哪些具体工作</h2><p class="caption">抽看三种用途。每类人数按本批记录去重；摘列一个真实任务的公开主题，不能代表该组所有人。</p><div class="content-examples">${examples.join('')||'<p>本批没有匹配这些用途的任务。</p>'}</div><h3>优先看谁，以及向他们确认什么</h3><dl class="content-follow"><div><dt><button type="button" data-content-cohort="repay">多次付款 · ${fmt(paid)} 人</button></dt><dd>内容后台记录至少两笔付款。对照此人的任务，核实是否为同一种工作再次购买。</dd></div><div><dt><button type="button" data-content-cohort="repeatDays">跨日创建任务 · ${fmt(days)} 人</button></dt><dd>至少两个不同日期创建了任务。比较首末任务，看是返工、延续同一主题，还是有了新的工作。</dd></div></dl></section>`;
}
function contentMix(d){
  const g=contentUI.groups,total=d.summary?.users;
  return `<section class="content-mix"><h2>同一人会跨格式使用吗？</h2><dl class="content-follow"><div><dt>摘要中明确写到两种格式</dt><dd>本批 ${contentNumber(total)} 人中，<button class="text-button" type="button" data-content-cohort="mentionsBoth">${fmt(g.mentionsBoth.size)} 人</button>的摘要同时或分别提到“小红书”和“小绿书”。按不同任务的创建时间，先提小红书再提小绿书 <button type="button" class="text-button" data-content-cohort="mentionsForward">${fmt(g.mentionsForward.size)} 人</button>，反向 <button type="button" class="text-button" data-content-cohort="mentionsReverse">${fmt(g.mentionsReverse.size)} 人</button>。同一人可双向出现。</dd></div><div><dt>后台记录了两种后续动作</dt><dd><button type="button" class="text-button" data-content-cohort="bothActions">${fmt(g.bothActions.size)} 人</button>既有小红书交接记录，也有公众号草稿同步记录。公众号草稿不能当作小绿书产物。</dd></div><div><dt>实际先生成小红书，再生成小绿书</dt><dd>目前无法计数。需要同一用户逐件产物的类型、成功状态和生成时间；摘要、交接、草稿都不能替代。</dd></div></dl></section>`;
}
function contentImportHTML(){return '<details class="content-method content-import"><summary>更新内容数据</summary><p>这里展示已发布的内容快照。数据由维护者在本机核验后更新。</p><button disabled>导入并核验</button></details>';}

function contentBindImport(){}

function contentToolbar(d){
  return `<div class="content-toolbar"><label class="content-search"><span class="sr-only">搜索任务摘要、用户或任务 ID</span><input id="contentSearch" type="search" value="${esc(contentUI.query)}" placeholder="搜索任务主题、匿名用户或任务编号"></label><label><span class="sr-only">用途规则</span><select id="contentPurpose"><option value="all">全部用途</option>${contentArray(d.purposes).map(p=>`<option value="${esc(p.id)}" ${contentUI.purpose===p.id?'selected':''}>${esc(p.id==='unknown'?'未识别用途':p.label)}</option>`).join('')}</select></label><label><span class="sr-only">付款记录</span><select id="contentPayment">${[['all','全部付款关联'],['paid','有付款记录'],['no_payment','当前订单无付款'],['unlinked','付款身份未连接']].map(([v,s])=>`<option value="${v}" ${contentUI.payment===v?'selected':''}>${s}</option>`).join('')}</select></label><label><span class="sr-only">用户任务数量</span><select id="contentRepeat">${[['all','全部任务用户'],['multiple','多任务用户（2+）'],['single','仅 1 个任务']].map(([v,s])=>`<option value="${v}" ${contentUI.repeat===v?'selected':''}>${s}</option>`).join('')}</select></label><label><span class="sr-only">后续动作</span><select id="contentAction">${[['all','全部后续动作'],['xhs_handoff','已记录小红书交接'],['oa_draft_synced','公众号草稿已同步'],['xhs','摘要提到小红书'],['green','摘要提到小绿书']].map(([v,s])=>`<option value="${v}" ${contentUI.action===v?'selected':''}>${s}</option>`).join('')}</select></label><label><span class="sr-only">测试账号</span><select id="contentAccount">${[['all','包含全部账号'],['excludeTest','排除明确测试账号'],['sourceTest','仅明确测试账号']].map(([v,s])=>`<option value="${v}" ${contentUI.account===v?'selected':''}>${s}</option>`).join('')}</select></label><button type="button" data-content-reset>清空筛选</button></div>`;
}
function contentRenderResults(){
  const root=document.querySelector('#contentResults');if(!root)return;
  const rows=contentFiltered(),users=new Set(rows.map(t=>t.user_key)),totalPages=Math.max(1,Math.ceil(rows.length/contentUI.size));
  contentUI.page=Math.max(1,Math.min(totalPages,contentUI.page));
  const start=(contentUI.page-1)*contentUI.size,visible=rows.slice(start,start+contentUI.size);
  root.innerHTML=`<div class="content-result-heading"><div><h2>具体任务与用途证据</h2><p role="status">当前筛选 <b>${fmt(rows.length)}</b> 个任务 · <b>${fmt(users.size)}</b> 名去重用户；本批全部 ${contentNumber(contentUI.data.summary?.tasks)} 个任务 / ${contentNumber(contentUI.data.summary?.users)} 人</p>${contentUI.cohort!=='all'?`<p class="content-user-filter">分组：${esc(contentCohorts[contentUI.cohort]||'未知分组')} · 显示组内用户的全部任务 <button type="button" class="text-button" data-content-clear-cohort>取消分组</button></p>`:''}${contentUI.task?`<p class="content-user-filter">指定任务 #${esc(contentUI.task)} <button type="button" class="text-button" data-content-clear-task>取消限定</button></p>`:''}${contentUI.user?`<p class="content-user-filter">仅看用户 ${esc(contentUI.user)} <button type="button" class="text-button" data-content-clear-user>取消用户限定</button></p>`:''}</div><div class="content-result-tools"><label><span class="sr-only">排序方式</span><select id="contentSort">${[['recent','报告顺序（最近对话优先）'],['created','新建任务优先'],['tasks','多任务用户优先']].map(([v,s])=>`<option value="${v}" ${contentUI.sort===v?'selected':''}>${s}</option>`).join('')}</select></label><button type="button" data-content-export ${rows.length?'':'disabled'}>导出筛选结果</button></div></div><div class="content-table-scroll" tabindex="0" aria-label="真实任务列表，左右滚动查看全部字段"><table class="content-task-table"><thead><tr><th scope="col">公开主题与任务</th><th scope="col">内容账号</th><th scope="col">用途线索 · 摘要匹配</th><th scope="col">后续动作与记录时间</th></tr></thead><tbody>${visible.length?visible.map(contentTaskRow).join(''):'<tr><td colspan="4" class="empty"><strong>当前筛选没有任务</strong>可调整关键词、用途或付款关联条件；空结果不是数据被删除。</td></tr>'}</tbody></table></div><div class="pagination content-pagination"><span>${rows.length?`${fmt(start+1)}–${fmt(Math.min(start+contentUI.size,rows.length))}`:'0'} / ${fmt(rows.length)} 个任务</span><div class="actions"><label><span class="sr-only">每页任务数量</span><select id="contentPageSize">${[25,50,100].map(v=>`<option value="${v}" ${contentUI.size===v?'selected':''}>每页 ${v} 个</option>`).join('')}</select></label><button type="button" data-content-page="${contentUI.page-1}" ${contentUI.page<=1?'disabled':''}>上一页</button><span>${contentUI.page} / ${totalPages}</span><button type="button" data-content-page="${contentUI.page+1}" ${contentUI.page>=totalPages?'disabled':''}>下一页</button></div></div>`;
}
function contentCSVRows(){
  return [['匿名任务','匿名用户','创建月份','公开工作主题','用途标签','付款关联','用户任务数','小红书交接','公众号草稿同步'],...contentFiltered().map(t=>[t.id,t.user_key,t.created_at,t.summary,t.labels.map(l=>l.label).join('、'),contentPaymentLabel(t),contentTaskCount(t),t.source_flags.xhs_handoff?'有':'无记录',t.source_flags.oa_draft_synced?'有':'无记录'])];
}

function contentExport(){
  const cell=v=>{let s=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const csv='\ufeff'+contentCSVRows().map(r=>r.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Prezto-内容任务-当前筛选.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function contentChooseFilter(field,value){
  Object.assign(contentUI,contentDefaults,{[field]:String(value),page:1});state.contentUser=contentUI.user;
  renderContent(contentUI.data);saveURL();document.querySelector('#contentResults')?.scrollIntoView({block:'start'});
}
function renderContent(d){
  const firstVisit=!contentUI.initialized;contentInitialFilters();contentUI.data=d;contentUI.groups=contentGroupIndex(d);state.content=d;if(state.contentUser!==undefined)contentUI.user=state.contentUser||'';
  const root=document.querySelector('#insightView');root.onclick=null;root.onchange=null;root.oninput=null;
  if(d.status!=='available'){
    root.innerHTML=`<div class="content-unavailable" role="status"><h2>${d.status==='invalid'?'内容批次未通过校验':'尚未接入可读取的内容批次'}</h2><p>${esc(d.reason||'当前没有可用的任务内容，不展示推测的用途分布。')}</p>${contentArray(d.limitations).map(s=>`<p>${esc(s)}</p>`).join('')}${contentImportHTML()}<button type="button" data-view="sources">查看数据连接</button></div>`;contentBindImport(root);return;
  }
  if(!['all',...contentArray(d.purposes).map(p=>p.id)].includes(contentUI.purpose))contentUI.purpose='all';
  const s=d.summary||{},b=d.batch||{};
  root.innerHTML=`<div class="content-view"><div class="content-intro"><p>从真实任务摘要看用户正在做什么。本页覆盖内容后台导出的账号，含来源明确标记的测试账号；未标记不等于已确认客户。</p><span>内容独立导出于 ${esc(contentDate(b.generated_at))}</span></div>${contentImportHTML()}<div class="content-scale"><div><span>本批内容任务</span><b>${contentNumber(s.tasks)} <small>个</small></b><small>按任务 ID 去重</small></div><div><span>本批内容账号</span><b>${contentNumber(s.users)} <small>人</small></b><small>按用户 ID 去重 · ${contentNumber(s.source_test_tag_users)} 人标记为测试</small></div><div><span>摘要匹配到用途</span><b>${contentPercent(contentRatio(s.matched_purpose_tasks,s.tasks))}</b><small>${contentNumber(s.matched_purpose_tasks)} 个任务 · 标签可重叠</small></div><div><span>尚未识别用途</span><b>${contentNumber(s.unidentified_tasks)} <small>个</small></b><small>保留未知，不强制归类</small></div></div>${contentWorkBrief(d)}<div class="content-main-grid"><section class="content-purpose-panel" aria-labelledby="contentPurposeTitle"><div class="content-panel-heading"><div><h2 id="contentPurposeTitle">用户用 Prezto 做什么</h2><p>摘要用途线索 · 每条占本批 ${contentNumber(s.tasks)} 个任务；人数按各标签去重</p></div><div class="content-mode" role="group" aria-label="用途分布显示方式"><button type="button" data-content-mode="chart" aria-pressed="${contentUI.mode==='chart'}">图表</button><button type="button" data-content-mode="table" aria-pressed="${contentUI.mode==='table'}">表格</button></div></div><div id="contentPurposePlot">${contentPurposes(d)}</div><p class="content-chart-note">同一任务可属于多个用途，条形和人数不能相加。点击某一用途，在下方查看对应任务、工作主题和用途。</p></section>${contentCoverage(d)}</div>${contentMix(d)}${contentDistribution(d)}<section class="table-panel content-list" aria-label="可筛选的内容任务">${contentToolbar(d)}<div id="contentResults"></div></section><details class="content-method content-batch"><summary>查看内容批次、日期与完整限制</summary><dl><div><dt>导出批次</dt><dd>${esc(b.generation_id||'未提供')}</dd></div><div><dt>独立生成时间</dt><dd>${esc(contentDate(b.generated_at))}</dd></div><div><dt>任务创建范围</dt><dd>${esc(contentDate(b.task_created_start))} — ${esc(contentDate(b.task_created_end))}</dd></div><div><dt>会话记录范围</dt><dd>${esc(contentDate(b.conversation_start))} — ${esc(contentDate(b.conversation_end))}</dd></div><div><dt>摘要截断记录</dt><dd>${contentNumber(s.truncated_summaries)} 个；仅按返回摘要识别</dd></div></dl><ul>${contentArray(d.limitations).map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p>此内容批次有自己的生成时间，不随商业卡片的同步时间自动更新。</p></details></div>`;
  contentBindImport(root);contentRenderResults();if(firstVisit&&Object.keys(contentDefaults).some(k=>contentUI[k]!==contentDefaults[k]))document.querySelector('#contentResults')?.scrollIntoView({block:'start'});
  root.oninput=e=>{if(e.target.id==='contentSearch'){contentUI.query=e.target.value;contentUI.page=1;contentRenderResults();saveURL();}};
  root.onchange=e=>{const fields={contentPurpose:'purpose',contentPayment:'payment',contentRepeat:'repeat',contentAccount:'account',contentAction:'action',contentSort:'sort',contentPageSize:'size'},field=fields[e.target.id];if(!field)return;contentUI[field]=field==='size'?Number(e.target.value):e.target.value;contentUI.page=1;contentRenderResults();saveURL();if(field==='purpose')document.querySelectorAll('[data-content-purpose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.contentPurpose===contentUI.purpose)));};
  root.onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.contentCohort){contentChooseFilter('cohort',b.dataset.contentCohort);return;}
    if(b.dataset.contentTask){contentChooseFilter('task',b.dataset.contentTask);return;}
    if(b.hasAttribute('data-content-clear-cohort')){contentUI.cohort='all';contentUI.page=1;contentRenderResults();saveURL();return;}
    if(b.hasAttribute('data-content-clear-task')){contentUI.task='';contentUI.page=1;contentRenderResults();saveURL();return;}
    if(b.dataset.contentPurpose!==undefined){contentChooseFilter('purpose',b.dataset.contentPurpose);return;}
    if(b.dataset.contentUser!==undefined){contentChooseFilter('user',b.dataset.contentUser);return;}
    if(b.dataset.contentAction!==undefined){contentChooseFilter('action',b.dataset.contentAction);return;}
    if(b.dataset.contentMode){contentUI.mode=b.dataset.contentMode;document.querySelector('#contentPurposePlot').innerHTML=contentPurposes(d);root.querySelectorAll('[data-content-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.contentMode===contentUI.mode)));return;}
    if(b.hasAttribute('data-content-reset')){Object.assign(contentUI,contentDefaults,{page:1});state.contentUser='';renderContent(d);saveURL();document.querySelector('#contentSearch')?.focus();return;}
    if(b.hasAttribute('data-content-clear-user')){contentUI.user='';state.contentUser='';contentUI.page=1;contentRenderResults();saveURL();return;}
    if(b.dataset.contentPage){contentUI.page=Number(b.dataset.contentPage);contentRenderResults();return;}
    if(b.hasAttribute('data-content-export'))contentExport();
  };
}
function mountContentProfile(d){
  const supplied=d.content;if(!supplied)return;
  const p=supplied.profile;if(!p)return;const batch=supplied.batch||d.content_batch||state.content?.batch||{},key=p.key||d.user?.key;
  if(p.status==='unavailable'||supplied.status==='unavailable')return;
  const tasks=contentArray(p.tasks),visible=tasks.slice(0,8),purposes=contentArray(supplied.purposes||p.purposes);
  const section=document.createElement('section');section.className='detail-section content-profile';
  const labels=purposes.length?purposes.filter(v=>v.id!=='unknown').map(v=>typeof v==='string'?v:v.label):contentArray(p.purpose_ids).map(id=>contentArray(state.content?.purposes).find(x=>x.id===id)?.label||id);
  const paid=p.payment_status==='paid'||p.paid===true,unknown=p.payment_status==='unlinked'||(!p.payment_status&&p.paid==null);
  section.innerHTML=`<div class="section-heading"><h3>这位用户具体在做什么</h3><span class="caption">内容导出 ${esc(contentDate(batch.generated_at))}</span></div><div class="content-profile-facts"><div><span>本批具体任务</span><b>${contentNumber(p.task_count)} 个</b><small>任务创建 ${esc(contentDate(p.first_created_at))} — ${esc(contentDate(p.last_created_at))}</small></div><div><span>跨日创建任务</span><b>${(state.content?.groups?.repeatDays||[]).includes(key)?'有记录':'未统计'}</b><small>仅本批记录，不是完整成功活跃天数</small></div><div><span>付款记录</span><b>${unknown?'付款身份未连接':paid?(contentKnown(p.payment_cents)?money(p.payment_cents):'有付款记录'):'当前订单无付款'}</b><small>${paid?'付款与内容用途分别观察':'不能推断用户的付费意愿或终身状态'}</small></div></div>${contentArray(p.self_descriptions).length?`<div class="content-profile-themes"><b>来源中的身份自述</b>${p.self_descriptions.map(x=>`<p><strong>${esc([x.industry,x.role].filter(Boolean).join(' · ')||'身份线索')}</strong> · 任务 #${esc(x.task_id)}<br><q>${esc(x.quote)}</q></p>`).join('')}<small>仅代表该用户在任务里的自述，不外推到同类作者。</small></div>`:''}<p class="content-profile-themes"><b>摘要中的工作主题</b> ${labels.length?labels.map(esc).join('、'):'尚未匹配到用途'}<small>这些是任务线索，不能直接作为行业或职业事实。</small></p><div class="content-profile-tasks">${visible.map(t=>`<article><div class="content-task-meta"><span>任务 ${esc(t.task_id||t.id)}</span><span>${esc(contentDate(t.created_at))}</span></div>${contentTaskSummary(t)}${contentInputs(t)}${contentActions(t)}<div class="content-task-source">${contentSource(t)}<span>${t.detail_available?'已读取部分详情':'当前仅有汇总'}</span></div></article>`).join('')||'<p class="caption">本批没有可显示的具体任务摘要；不能据此推断用户没有工作需求。</p>'}</div><button type="button" class="text-button" data-content-profile-all>查看此用户全部 ${contentNumber(p.task_count)} 个内容任务 →</button><p class="caption">此处最多显示 8 个任务；后续交接或草稿同步不等于正式发布，摘要出现格式词也不证明真实产出交集。</p>`;
  section.querySelector('[data-content-profile-all]').addEventListener('click',()=>{Object.assign(contentUI,contentDefaults,{user:key,page:1});state.contentUser=key;document.querySelector('#detailDialog')?.close();setView('content');});
  document.querySelector('#detailBody').prepend(section);
}

;
'use strict';

// Population-level charts use each source's own denominator and observation
// window. No category, temporal comparison or missing value is invented here.
const populationUI={data:null,modes:{},panels:{}};
function populationKnown(value){return typeof value==='number'&&Number.isFinite(value);}
function populationNumber(value){return populationKnown(value)?fmt(value):'未提供';}
function populationPercent(value){return populationKnown(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:2})+'%':'未提供';}
function populationArray(value){return Array.isArray(value)?value:value?[value]:[];}
function populationWindow(value){
  if(value?.as_of)return `提取于 ${stamp(value.as_of)}`;
  if(value?.start&&value?.end)return `${value.start} — ${value.end}`;
  if(value?.end)return `截至 ${value.end}`;
  return '来源未提供窗口';
}
function populationSource(id){return `<a href="?view=sources">q${Number(id)}</a>`;}
function populationUserLink(filter){
  if(!filter?.population)return null;
  const query=new URLSearchParams({view:filter.population});
  for(const [key,value] of Object.entries(filter))if(key!=='population'&&value!==null&&value!==undefined)query.set(key,String(value));
  return '?'+query.toString();
}
function populationMethod(panel){
  return `<details class="population-method"><summary>查看分母、窗口与来源</summary><dl><div><dt>分母</dt><dd>${esc(panel.denominatorLabel||'本图统计范围')} · ${populationNumber(panel.denominator)} 人</dd></div><div><dt>窗口</dt><dd>${esc(populationWindow(panel.window))}</dd></div>${populationArray(panel.sources).map(id=>`<div><dt>${populationSource(id)}</dt><dd>提取于 ${esc(stamp(populationUI.data.source_dates?.[String(id)]))||'未记录'}</dd></div>`).join('')}</dl>${populationArray(panel.limits).length?`<ul>${populationArray(panel.limits).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}</details>`;
}
function populationChart(panel){
  if(panel.status==='unavailable')return `<div class="population-unavailable"><strong>当前无法生成这项分布</strong><p>${esc(panel.reason||'来源没有提供可核对的数据，保留未知。')}</p></div>`;
  if(!panel.rows?.length)return '<div class="population-unavailable"><strong>来源尚未返回分类记录</strong><p>未返回分类不代表所有用户都属于某一类。</p></div>';
  if(populationUI.modes[panel.id]==='table'){
    return `<div class="population-table-scroll" tabindex="0" aria-label="${esc(panel.title)}数据表"><table><thead><tr><th scope="col">${esc(panel.categoryLabel||'分类')}</th><th scope="col">人数</th><th scope="col">占本图分母</th><th scope="col">用户记录</th></tr></thead><tbody>${panel.rows.map(r=>{const link=populationUserLink(r.filter);return `<tr><th scope="row">${esc(r.label)}</th><td>${populationNumber(r.count)}</td><td>${populationPercent(r[panel.percentKey||'percent'])}</td><td>${link?`<a href="${esc(link)}">查看名单</a>`:'无对应明细筛选'}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  return `<div class="population-bars" role="group" aria-label="${esc(panel.title)}，各条占比的分母为 ${populationNumber(panel.denominator)} 人">${panel.rows.map(r=>{
    const percent=r[panel.percentKey||'percent'],valid=populationKnown(percent),width=valid?Math.max(0,Math.min(100,percent)):0;
    const link=populationUserLink(r.filter),tag=link?'a':'div';
    return `<${tag} ${link?`href="${esc(link)}"`:''} class="population-bar-row ${link?'is-linked':''} ${r.id==='unknown'||r.id==='check'?'is-unknown':''}"><span class="population-bar-label">${esc(r.label)}</span><span class="population-bar-track" aria-hidden="true">${valid?`<span style="width:${width}%"></span>`:''}</span><span class="population-bar-count">${populationNumber(r.count)} <small>人</small></span><span class="population-bar-percent">${populationPercent(percent)}</span>${link?'<span class="sr-only">，查看这些用户</span>':''}</${tag}>`;
  }).join('')}</div><p class="population-chart-note">条形长度表示占本图分母的比例${panel.rows.some(r=>r.filter)?'；点击有链接的分类查看用户名单。':'。'}</p>`;
}
function populationPanel(panel){
  if(panel.status==='unavailable')panel={...panel,denominator:null};
  populationUI.panels[panel.id]=panel;
  const table=populationUI.modes[panel.id]==='table';
  return `<section class="population-panel ${panel.className||''}" aria-labelledby="population-title-${panel.id}"><div class="population-panel-heading"><div><h2 id="population-title-${panel.id}">${esc(panel.title)}</h2><p>${esc(panel.subtitle||'')}</p></div><div class="population-view-toggle" role="group" aria-label="${esc(panel.title)}显示方式"><button type="button" data-population-mode="chart" data-population-panel="${panel.id}" aria-pressed="${!table}">图表</button><button type="button" data-population-mode="table" data-population-panel="${panel.id}" aria-pressed="${table}">表格</button></div></div><div class="population-denominator"><span>${esc(panel.denominatorLabel||'统计范围')}</span><b>${populationNumber(panel.denominator)} 人</b><span>${esc(populationWindow(panel.window))}</span></div><div id="population-plot-${panel.id}">${populationChart(panel)}</div>${panel.footnote?`<p class="population-panel-note">${esc(panel.footnote)}</p>`:''}${populationMethod(panel)}</section>`;
}
function populationDemographic(field,title){
  const d=field||{},hasCoverage=populationKnown(d.identified)&&populationKnown(d.denominator);
  const known=hasCoverage&&d.identified>0;
  const breakdown=populationArray(d.buckets).filter(r=>populationKnown(r.count)&&r.count>0);
  return `<section class="population-demographic"><div class="population-demographic-title"><h3>${esc(title)}</h3><span>${known?'已有部分证据':'尚未形成可用分布'}</span></div><div class="population-coverage-count"><b>${populationNumber(d.identified)}</b><span> / ${populationNumber(d.denominator)} 人已识别</span><strong>未识别 ${populationPercent(d.unknown_percent)}</strong></div>${hasCoverage&&d.denominator>0?`<div class="population-coverage-track" role="img" aria-label="${esc(title)}证据覆盖 ${populationPercent(d.coverage_percent)}，未识别 ${populationPercent(d.unknown_percent)}"><span style="width:${populationKnown(d.coverage_percent)?Math.max(0,Math.min(100,d.coverage_percent)):0}%"></span></div>`:''}${known?`<div class="population-demographic-rows">${breakdown.map(r=>`<div><span>${esc(r.label)}</span><b>${populationNumber(r.count)} 人</b><small>占全体 ${populationPercent(r.percent_total)}</small></div>`).join('')}</div>`:`<p class="population-coverage-empty">当前有 ${populationNumber(d.unknown)} 人缺少可归类的${esc(title)}证据。无法据此判断用户来自哪些${title==='行业'?'行业':'岗位'}。</p>`}<p class="population-unknown-count">未识别：${populationNumber(d.unknown)} 人${known?' · 已识别样本不代表总体结构':''}</p><details class="population-method"><summary>${esc(title)}如何识别</summary><p>分母为当前可见注册用户，只计入有证据、身份已连接且无冲突的本地画像；未填写或证据不足保持未识别。</p><p>未关联注册的档案 ${populationNumber(d.excluded_unlinked)} 份；冲突排除 ${populationNumber(d.excluded_conflicts)} 份。</p>${populationArray(d.limits).length?`<ul>${populationArray(d.limits).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}</details></section>`;
}
function populationTrend(all){
  const rows=populationArray(all?.trend);if(!rows.length)return '';
  return `<details class="population-trend"><summary>查看来源已提供的逐日滚动 7 日数据</summary><p class="caption">每一行都是该截止日的滚动 7 日窗口，窗口之间重叠，人数不可相加。这里只展示来源实际返回的日期。</p><div class="population-table-scroll" tabindex="0" aria-label="全站滚动7日使用频次历史"><table><thead><tr><th scope="col">窗口截止日</th><th scope="col">成功使用人数</th><th scope="col">使用至少 2 天</th><th scope="col">使用至少 3 天</th></tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><th scope="row">${esc(r.date)}</th><td>${populationNumber(r.denominator)}</td><td>${populationPercent(r.multi_day_percent)}</td><td>${populationPercent(r.three_plus_percent)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function populationContent(c){
  if(c?.status!=='available')return '<div class="population-evidence"><h2>真实工作用途</h2><p>当前没有可读的内容报告。</p><a href="?view=content">查看内容来源与导入</a></div>';
  const s=c.summary||{},top=c.leading_purposes||[],claims=c.self_descriptions||{},byRole=new Map();
  for(const r of claims.rows||[]){if(!byRole.has(r.role))byRole.set(r.role,new Map());byRole.get(r.role).set(r.user_key,r);}
  return `<section class="population-evidence" aria-label="从任务理解用户"><div class="population-panel-heading"><div><h2>用户带着什么工作来？</h2><p>内容报告 · ${esc(stamp(c.batch?.generated_at))} · ${populationNumber(s.users)} 人的 ${populationNumber(s.tasks)} 个任务</p></div><a href="?view=content">查看任务与用途 →</a></div>
    <div class="population-story"><div><h3>最常出现的用途线索</h3>${top.length?top.map(r=>`<a class="population-lead" href="?view=content&amp;purpose=${encodeURIComponent(r.id)}"><b>${esc(r.label)}</b><span>${populationNumber(r.user_count)} 人 · ${populationNumber(r.task_count)} 个任务 →</span></a>`).join(''):'<p>没有可识别的摘要。</p>'}<small>按涉及人数排序，一人可涉及多种用途。${populationNumber(s.unidentified_tasks)} 个任务未命中词表。</small></div>
    <div><h3>哪些人值得先了解？</h3><p>扣除后台明确标记的 ${populationNumber(s.source_test_tag_users)} 个测试账号后，剩余 ${populationNumber(c.field_accounts)} 个账号中，<b>${populationNumber(c.repeat_task_users)} 人</b>建过至少两个任务，<b>${populationNumber(c.repeat_paid_users)} 人</b>有两笔及以上付款记录。</p><p>优先看既有付款又建过多个任务的 <b>${populationNumber(c.repeat_task_paid_users)} 人</b>。对比他们前后两份材料，核实是反复完成同一种工作，还是在尝试另一种用途。</p><a href="?view=content&amp;account=excludeTest&amp;payment=paid&amp;repeat=multiple">查看这些人的真实任务 →</a></div></div>
    ${byRole.size?`<div class="population-identity-examples"><h3>用户在任务里如何介绍自己</h3><p>${populationNumber(claims.users)} 人的摘要中匹配到明确的第一人称角色表述。这些自述尚未核实为本人职业，不能用来估算全站行业占比。</p><ul>${[...byRole].map(([role,accounts])=>{const r=accounts.values().next().value;return `<li><a href="?view=content&amp;task=${encodeURIComponent(r.task_id)}"><b>${esc(role)}</b> · ${accounts.size} 人<span>查看任务中的角色线索 →</span></a></li>`;}).join('')}</ul></div>`:''}</section>`;
}
function renderPopulation(d){
  populationUI.data=d;populationUI.panels={};state.population=d;
  const b=d.business||{},registered=d.registered||{},all=d.frequency?.all_users||{},paid=d.frequency?.paid||{};
  const total=registered.denominator;
  const oneDay=populationArray(all.buckets).find(r=>r.id==='one'||r.id==='one_day'||r.id==='1'||r.label==='1天'||r.label==='1 天');
  const recentNote=all.status==='available'&&oneDay&&populationKnown(oneDay.percent)?`近 7 天成功使用者中，${populationPercent(oneDay.percent)} 只使用了 1 天。`:'查看成功使用者在最近 7 个完整日里使用了几天。';
  const frequencyPanel={id:'frequency',title:'全站最近 7 天，成功使用了几天',subtitle:recentNote,status:all.status,reason:all.reason,rows:all.buckets,denominator:all.denominator,denominatorLabel:all.denominator_label||'窗口内至少成功使用 1 天的用户',window:all.window,sources:[8765],limits:all.limits,footnote:'本图不限付款状态，单位为成功使用天数。未使用者不在这个分母内；聚合来源没有返回可逐人反查的完整名单。'};
  const depthPanel={id:'depth',title:'累计创建过多少任务',subtitle:'互斥分组，人数合计等于当前可见注册用户。',status:registered.status,rows:registered.task_frequency,denominator:total,denominatorLabel:'可见注册用户',window:registered.window,sources:[7996],limits:registered.limits,footnote:'累计任务深度不是最近一周的使用频次；创建任务不等于成功交付或实际采用。'};
  const sourcePanel={id:'sources',title:'这些用户从哪里来',subtitle:'按注册来源查看规模；点击来源进入对应的真实用户名单。',status:registered.status,rows:registered.sources,denominator:total,denominatorLabel:'可见注册用户',window:registered.window,sources:[7996],limits:registered.limits,categoryLabel:'注册来源',footnote:'获客来源不是行业或职位，不用渠道名称推断用户身份。'};
  const paidPanel={id:'paid',title:'付款用户的近期使用分布',subtitle:'单独查看付款来源的用户，避免与全站成功使用者混用分母。',status:paid.status,reason:paid.reason,rows:paid.buckets,denominator:paid.denominator,denominatorLabel:'付款来源中的用户',window:paid.window,sources:[8016],limits:paid.limits,footnote:'使用仅统计首次付款后的成功运行。0 天表示本窗口没有成功使用，不等于已流失。'};
  const statePanel={id:'states',title:'注册用户的任务与交付状态',subtitle:'由累计任务、产物和积分消耗组成的互斥状态，可打开对应名单。',status:registered.status,rows:registered.states,denominator:total,denominatorLabel:'可见注册用户',window:registered.window,sources:[7996],limits:registered.limits};
  const root=document.querySelector('#insightView');
  root.innerHTML=`<div class="population-view"><div class="population-scope"><span>群体结构与证据覆盖</span><p>先看整体规模和使用结构，再看已识别的行业、职位。每张图分别标明自己的统计范围。</p></div><div class="population-scale"><div><span>可见注册用户</span><b>${populationNumber(b.availability?.registered==='unavailable'?null:b.registered_users)} <small>人</small></b><small>注册来源范围，不宣称完整全量</small></div><div><span>近 7 天全站成功使用</span><b>${populationNumber(all.denominator)} <small>人</small></b><small>${esc(populationWindow(all.window))}</small></div><div><span>付款记录中的用户</span><b>${populationNumber(b.availability?.paid_users==='unavailable'?null:b.paid_users)} <small>人</small></b><small>订单：${esc(populationWindow(b.payment_window))}</small></div><div><span>有效付款订单</span><b>${populationNumber(b.availability?.orders==='unavailable'?null:b.orders)} <small>笔</small></b><small>${b.availability?.orders!=='unavailable'&&populationKnown(b.paid_cents)?money(b.paid_cents)+' · 非净收入':'金额未提供'}</small></div></div>
    ${populationContent(d.content)}
    <div class="population-main-grid">${populationPanel(frequencyPanel)}<section class="population-panel population-demographics" aria-labelledby="population-demographic-title"><div class="population-panel-heading"><div><h2 id="population-demographic-title">已核实的行业与职位</h2><p>注册来源没有这两个字段。这里只统计经复核且有原始证据的档案，自述线索单列在上方。</p></div></div>${populationDemographic(d.demographics?.industry,'行业')}${populationDemographic(d.demographics?.role,'职位 / 角色')}<a class="population-profile-entry" href="?view=registered">查看注册名单，补充有证据的行业与职位 →</a></section></div>
    <div class="population-grid">${populationPanel(depthPanel)}${populationPanel(sourcePanel)}</div>
    <details class="population-expand"><summary>展开付款用户对照与任务交付状态</summary><div class="population-grid">${populationPanel(paidPanel)}${populationPanel(statePanel)}</div></details>
    ${populationTrend(all)}<details class="population-boundaries"><summary>大盘覆盖与暂不支持的分析</summary><p>当前只提供来源支持的窗口：累计任务深度、滚动 7 日成功使用及付款来源。没有可用数据的周期不提供切换。</p>${b.conversion?.available===false?`<p>${esc(b.conversion.reason)}</p>`:''}<ul>${populationArray(d.limitations).map(s=>`<li>${esc(s)}</li>`).join('')}${['monthly','retention'].filter(k=>d.frequency?.[k]?.status==='unavailable').map(k=>`<li>${esc(d.frequency[k].reason)}</li>`).join('')}</ul><button type="button" class="text-button" data-view="sources">查看逐项数据连接 →</button></details></div>`;
  root.oninput=null;root.onchange=null;
  root.onclick=e=>{
    const button=e.target.closest('[data-population-mode]');if(!button)return;
    const id=button.dataset.populationPanel,mode=button.dataset.populationMode,panel=populationUI.panels[id];
    if(!panel||!['chart','table'].includes(mode))return;
    populationUI.modes[id]=mode;
    document.querySelector('#population-plot-'+id).innerHTML=populationChart(panel);
    root.querySelectorAll(`[data-population-panel="${id}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.populationMode===mode)));
  };
}

;
'use strict';

// This view consumes the validated priority API. It never assigns occupations,
// motives, or verified value from payment totals or product formats.
const priorityUI = {data:null, group:'all', query:'', sort:'dimensions', page:1, size:25, matrix:null};

function priorityText(value, missing='未记录') {
  return value === null || value === undefined || value === '' ? missing : String(value);
}
function priorityList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}
function priorityActionTexts(profile) {
  return priorityList(profile.next_actions).map(item=>typeof item==='string'?item:item.action).filter(Boolean);
}
function priorityCount(value, unit='') {
  return value === null || value === undefined ? '未记录' : fmt(value)+unit;
}
function prioritySource(id) {
  return `<a href="?view=sources#source-${Number(id)}">q${Number(id)}</a>`;
}
function priorityProducts(profile) {
  const counts=profile.product_counts;
  if (counts && !Array.isArray(counts) && typeof counts==='object' && Object.keys(counts).length) {
    return Object.entries(counts).map(([name,count])=>`${name} × ${count}`).join('；');
  }
  return priorityList(profile.product_mix).map(item=>typeof item==='string'?item:item.product).filter(Boolean).join('、') || (profile.paid ? '商品信息未记录' : '订单窗口无付款');
}
function priorityName(profile) {
  const name=profile.name && profile.name!=='未填写昵称' ? profile.name : '账号 '+(profile.code||profile.user_id||'未连接');
  return `<div class="priority-identity"><button class="user-button" data-user="${esc(profile.key)}">${esc(name)}</button><span class="priority-code">${esc('公开账号')}</span></div>`;
}
function priorityWindow(w,start,end) {
  return w?.[start] && w?.[end] ? `${w[start]} — ${w[end]}` : '来源窗口未记录';
}
function priorityGroup() {
  return priorityUI.data.groups.find(g=>g.id===priorityUI.group);
}
function priorityRows() {
  const d=priorityUI.data, group=priorityGroup();
  const keys=priorityUI.matrix!==null ? new Set(d.matrix[priorityUI.matrix].keys) : group ? new Set(group.keys) : null;
  const query=priorityUI.query.trim().toLocaleLowerCase('zh-CN');
  let rows=(priorityUI.matrix!==null ? Object.values(d.profiles) : d.users).filter(p=>!keys||keys.has(p.key));
  if(query) rows=rows.filter(p=>[p.name,p.code,p.user_id,priorityProducts(p),...priorityList(p.priority_reasons),...priorityActionTexts(p)].map(v=>priorityText(v,'')).join(' ').toLocaleLowerCase('zh-CN').includes(query));
  const number=(p,key)=>typeof p[key]==='number'&&Number.isFinite(p[key])?p[key]:null;
  const field={amount:'amount_rank',orders:'payment_orders',recent:'paid_active_days_7',returns:'return_tasks_28'}[priorityUI.sort];
  rows=[...rows].sort((a,b)=>{
    if(priorityUI.sort==='name') return priorityText(a.name,a.code).localeCompare(priorityText(b.name,b.code),'zh-CN')||a.key.localeCompare(b.key);
    const av=field?number(a,field):priorityList(a.group_ids).length;
    const bv=field?number(b,field):priorityList(b.group_ids).length;
    if(av===null&&bv!==null)return 1;if(av!==null&&bv===null)return -1;
    return (bv??0)-(av??0)||a.key.localeCompare(b.key);
  });
  return rows;
}
function priorityReasons(profile) {
  const reasons=priorityList(profile.priority_reasons);
  if(!reasons.length) return '<span class="muted">当前分组未标记重点原因</span>';
  return `<ul class="priority-brief-list">${reasons.slice(0,2).map(r=>`<li>${esc(r)}</li>`).join('')}</ul>${reasons.length>2?`<details class="priority-more"><summary>另 ${reasons.length-2} 条依据</summary><ul>${reasons.slice(2).map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details>`:''}`;
}
function priorityUsage(profile) {
  const paid=profile.paid?`<b>${priorityCount(profile.paid_active_days_7,' 天')}</b><span>首付后 · 近 7 个完整日成功使用</span>`:'<span>不在当前付款名单</span>';
  const behavior=profile.in_behavior_top500?`28 日使用 ${priorityCount(profile.behavior_active_days_28,' 天')} · 跨天新任务 ${priorityCount(profile.return_tasks_28,' 个')}`:'未进入行为前 500 名单，28 日情况未知';
  return `<div class="priority-use">${paid}<small>${esc(behavior)}</small></div>`;
}
function priorityActions(profile) {
  const actions=priorityActionTexts(profile);
  const relevant=priorityList(profile.next_actions).find(a=>a.group_id===priorityUI.group)?.action||actions[0];
  return `<div class="priority-row-action">${relevant?`<p>${esc(relevant)}</p>`:'<p class="muted">先查看原始证据，记录待确认问题。</p>'}<button class="text-button" data-user="${esc(profile.key)}">查看证据与核查 →</button></div>`;
}
function priorityGroupDescription() {
  const d=priorityUI.data,g=priorityGroup(),matrix=priorityUI.matrix===null?null:d.matrix[priorityUI.matrix];
  const title=matrix?`${matrix.payment} · ${matrix.recent_success_days}`:g?.title||'全部重点用户';
  const rule=matrix?'按付款次数与最近 7 个完整日成功使用交叉查看，包含该交叉格的完整付款名单。':g?.rule||'至少符合一个重点规则的账号，按明确身份去重。同一用户可符合多个规则；分组人数不可相加。';
  const action=g?.action||'从具体账号查看任务、付款商品和使用记录，再决定要验证持续价值、解释未使用，还是复盘交付问题。';
  const count=matrix?.count??g?.count??d.users.length;
  const denominator=g?.denominator;
  document.querySelector('#priorityGroupInfo').innerHTML=`<div><div class="priority-group-heading"><h2>${esc(title)}</h2><span>${fmt(count)} 人${denominator!==null&&denominator!==undefined?` / ${g.population==='paid'?'付款用户':'行为名单'} ${fmt(denominator)} 人`:''}</span></div><p>${esc(rule)}</p><p class="priority-action-copy"><b>建议核查</b>${esc(action)}</p>${priorityList(g?.limits).length?`<details class="priority-rule-limits"><summary>这组数据的限制</summary><ul>${priorityList(g.limits).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details>`:''}</div><div class="priority-group-sources">${priorityList(g?.source_ids).map(prioritySource).join(' · ')}</div>`;
  document.querySelectorAll('[data-priority-group]').forEach(b=>b.setAttribute('aria-pressed',String(!matrix&&b.dataset.priorityGroup===priorityUI.group)));
}
function renderPriorityRows() {
  const rows=priorityRows(),size=priorityUI.size||Math.max(1,rows.length),pages=Math.max(1,Math.ceil(rows.length/size));
  priorityUI.page=Math.min(Math.max(1,priorityUI.page),pages);
  const offset=(priorityUI.page-1)*size,pageRows=rows.slice(offset,offset+size);
  document.querySelector('#priorityRows').innerHTML=pageRows.map(p=>`<tr><td>${priorityName(p)}</td><td>${priorityReasons(p)}</td><td><div class="priority-payment">${p.paid?`<b>${esc(p.amount_band || '未公开')}</b><span>${priorityCount(p.payment_orders,' 笔')} · 公开金额档</span>`:'<span>订单窗口无付款</span>'}<small>${esc(priorityProducts(p))}</small></div></td><td>${priorityUsage(p)}</td><td>${priorityActions(p)}</td></tr>`).join('')||`<tr><td colspan="5" class="empty"><strong>${priorityUI.query?'没有匹配的用户':'当前规则没有返回用户'}</strong>${priorityUI.query?'调整匿名编号、商品或行为关键词后再查看。':'这仅表示现有来源中没有符合规则的记录，不能推断这类用户不存在。'}${priorityUI.query?'<br><button type="button" class="text-button" data-priority-clear>清空搜索</button>':''}</td></tr>`;
  document.querySelector('#priorityResultCount').textContent=`${fmt(rows.length)} 人匹配 · 分组可重叠`;
  document.querySelector('#priorityPageInfo').textContent=rows.length?`第 ${priorityUI.page} / ${pages} 页 · ${fmt(offset+1)}–${fmt(Math.min(rows.length,offset+size))} / ${fmt(rows.length)} 人`:'0 人匹配';
  document.querySelector('#priorityPrev').disabled=priorityUI.page<=1;
  document.querySelector('#priorityNext').disabled=priorityUI.page>=pages;
  document.querySelector('#priorityExport').disabled=!rows.length;
}
function priorityMatrix(d) {
  if(!d.matrix?.length)return '';
  return `<details class="priority-matrix"><summary>付款次数与近期使用的交叉分布</summary><p class="caption">覆盖付款来源中的用户；点击任意一格查看完整名单。近 7 日未使用不等于已流失。</p><div class="priority-matrix-grid">${d.matrix.map((m,i)=>`<button type="button" data-priority-matrix="${i}"><span>${esc(m.payment)}</span><span>${esc(m.recent_success_days)}</span><b>${fmt(m.count)} 人</b></button>`).join('')}</div></details>`;
}
function renderPriority(d) {
  priorityUI.data=d;state.priority=d;
  if(state.priorityGroup&&state.priorityGroup!==priorityUI.group){priorityUI.group=state.priorityGroup;priorityUI.matrix=null;priorityUI.page=1;priorityUI.query='';}
  if(priorityUI.group!=='all'&&!d.groups.some(g=>g.id===priorityUI.group))priorityUI.group='all';
  state.priorityGroup=priorityUI.group;
  if(priorityUI.matrix!==null&&!d.matrix?.[priorityUI.matrix])priorityUI.matrix=null;
  const root=document.querySelector('#insightView'),s=d.summary||{};
  const paid=d.users.filter(p=>p.paid).length;
  root.innerHTML=`<div class="priority-view"><div class="priority-intro"><p>同时看商业投入、持续使用和待跟进的问题。重点名单用于安排核查，不自动认定职业、动机或核心价值。</p><button type="button" class="text-button" data-view="sources">查看数据连接 →</button></div>
    <div class="priority-summary"><div><span>去重后的重点名单</span><b>${fmt(d.users.length)} <small>人</small></b></div><div><span>名单中有付款记录</span><b>${fmt(paid)} <small>人</small></b></div><div><span>付款来源覆盖</span><b>${priorityCount(s.paid_users)} <small>人</small></b></div><div><span>行为明细覆盖</span><b>${priorityCount(s.behavior_top500_count)} <small>人</small></b><small>排序前 500，非全站用户</small></div></div>
    <div class="priority-groups" role="group" aria-label="按重点依据查看用户"><button type="button" data-priority-group="all" aria-pressed="false">全部重点用户 <span>${fmt(d.users.length)}</span></button>${d.groups.map(g=>`<button type="button" data-priority-group="${esc(g.id)}" aria-pressed="false">${esc(g.title)} <span>${fmt(g.count)}</span></button>`).join('')}</div>
    <section id="priorityGroupInfo" class="priority-group-info" aria-label="当前分组口径"></section>
    <section class="table-panel priority-list" aria-label="真实重点用户名单"><div class="priority-toolbar"><label class="priority-search"><span class="sr-only">搜索重点用户</span><input id="prioritySearch" type="search" value="${esc(priorityUI.query)}" placeholder="搜索匿名编号、商品或重点依据"></label><label class="priority-sort"><span class="sr-only">重点名单排序</span><select id="prioritySort"><option value="dimensions">命中维度从多到少</option><option value="amount">累计付款金额档从高到低</option><option value="orders">付款次数从多到少</option><option value="recent">近 7 日使用从多到少</option><option value="returns">28 日跨天新任务从多到少</option><option value="name">匿名编号顺序</option></select></label><button type="button" id="priorityExport">导出筛选名单</button></div><div class="priority-result-line"><h2>真实用户与下一步核查</h2><span id="priorityResultCount" role="status"></span></div><div class="priority-table-scroll" tabindex="0" aria-label="重点用户名单，窄屏可横向滚动"><table class="priority-table"><thead><tr><th scope="col">用户</th><th scope="col">为什么值得关注</th><th scope="col">付款与商品</th><th scope="col">近期成功使用</th><th scope="col">下一步</th></tr></thead><tbody id="priorityRows"></tbody></table></div><div class="pagination priority-pagination"><span id="priorityPageInfo" class="muted"></span><div class="actions"><label><span class="sr-only">重点名单每页人数</span><select id="prioritySize"><option value="25">25 人 / 页</option><option value="50">50 人 / 页</option><option value="100">100 人 / 页</option><option value="0">显示全部</option></select></label><button type="button" id="priorityPrev">上一页</button><button type="button" id="priorityNext">下一页</button></div></div></section>
    <div class="priority-windows"><span>订单：${esc(priorityWindow(d.windows,'orders_start','orders_end'))}</span><span>付款用户近期使用：${esc(priorityWindow(d.windows,'paid_recent_start','paid_recent_end'))}</span><span>行为名单：${esc(priorityWindow(d.windows,'behavior_start','behavior_end'))}</span></div>${d.windows?.paid_usage?`<p class="caption">${esc(d.windows.paid_usage)}</p>`:''}${priorityMatrix(d)}
    <details class="priority-limits"><summary>覆盖、来源与判断边界</summary><ul>${priorityList(d.limitations).map(v=>`<li>${esc(v)}</li>`).join('')}</ul><div class="priority-source-dates">${Object.entries(d.source_dates||{}).map(([id,date])=>`<span>${prioritySource(id)} · ${esc(stamp(date))||'未记录提取时间'}</span>`).join('')}</div><p class="caption">排序只改变查看顺序；重点规则不是已验证画像，付款金额不是净收入。</p></details></div>`;
  document.querySelector('#prioritySort').value=priorityUI.sort;
  document.querySelector('#prioritySize').value=String(priorityUI.size);
  priorityGroupDescription();renderPriorityRows();
  root.oninput=e=>{if(e.target.id==='prioritySearch'){priorityUI.query=e.target.value;priorityUI.page=1;renderPriorityRows();}};
  root.onchange=e=>{if(e.target.id==='prioritySort'){priorityUI.sort=e.target.value;priorityUI.page=1;renderPriorityRows();}if(e.target.id==='prioritySize'){priorityUI.size=Number(e.target.value);priorityUI.page=1;renderPriorityRows();}};
  root.onclick=e=>{
    const group=e.target.closest('[data-priority-group]'),matrix=e.target.closest('[data-priority-matrix]');
    if(group){priorityUI.group=group.dataset.priorityGroup;state.priorityGroup=priorityUI.group;priorityUI.matrix=null;priorityUI.page=1;priorityGroupDescription();renderPriorityRows();}
    if(matrix){priorityUI.matrix=Number(matrix.dataset.priorityMatrix);priorityUI.group='all';state.priorityGroup='all';priorityUI.page=1;priorityGroupDescription();renderPriorityRows();document.querySelector('#priorityGroupInfo').scrollIntoView({block:'start'});}
    if(e.target.closest('[data-priority-clear]')){priorityUI.query='';priorityUI.page=1;document.querySelector('#prioritySearch').value='';renderPriorityRows();document.querySelector('#prioritySearch').focus();}
    if(e.target.id==='priorityPrev'||e.target.id==='priorityNext'){priorityUI.page+=e.target.id==='priorityNext'?1:-1;renderPriorityRows();document.querySelector('.priority-table-scroll').scrollTop=0;}
    if(e.target.id==='priorityExport')exportPriority();
  };
}
function exportPriority() {
  const rows=priorityRows();if(!rows.length)return;
  const d=priorityUI.data,group=priorityGroup(),matrix=priorityUI.matrix===null?null:d.matrix[priorityUI.matrix];
  const label=matrix?`${matrix.payment} / ${matrix.recent_success_days}`:group?.title||'全部重点用户';
  const headers=['公开账号','本次筛选','重点依据','付款状态','累计付款金额档','付款订单数','付款商品','近7个完整日成功使用天数','28日成功使用天数（前500名单）','28日跨天新任务（前500名单）','下一步核查','判断限制','订单窗口','近期使用窗口','行为名单窗口','各来源提取时间'];
  const dates=Object.entries(d.source_dates||{}).map(([id,date])=>`q${id}: ${date||'未记录'}`).join('；');
  const cells=rows.map(p=>[p.key,label,priorityList(p.priority_reasons).join('；'),p.paid?'订单窗口有付款':'订单窗口无付款',p.amount_band||'',p.payment_orders,priorityProducts(p),p.paid_active_days_7,p.in_behavior_top500?p.behavior_active_days_28:null,p.in_behavior_top500?p.return_tasks_28:null,priorityActionTexts(p).join('；'),priorityList(p.limits).join('；'),priorityWindow(d.windows,'orders_start','orders_end'),priorityWindow(d.windows,'paid_recent_start','paid_recent_end'),priorityWindow(d.windows,'behavior_start','behavior_end'),dates]);
  const csvCell=value=>{let s=priorityText(value,'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const blob=new Blob(['\uFEFF'+[headers,...cells].map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`prezto-priority-${d.windows?.orders_end||'users'}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  if(typeof toast==='function')toast(`已导出当前筛选的 ${fmt(rows.length)} 位用户`);
}
function mountPriorityProfile(d) {
  const p=d.priority||d.priority_profile||state.priority?.profiles?.[d.user?.key];
  document.querySelector('#priorityProfile')?.remove();
  if(!p)return;
  const section=document.createElement('section');section.id='priorityProfile';section.className='detail-section priority-profile';
  const selectedAction=p.next_actions?.find(x=>x.group_id===state.priorityGroup)?.action;
  const allActions=priorityActionTexts(p),actions=selectedAction?[selectedAction,...allActions.filter(x=>x!==selectedAction)]:allActions,evidence=priorityList(p.evidence);
  const windows=d.priority_windows||state.priority?.windows||{};
  if(!windows.paid_recent_end&&p.source_dates?.['8016']){
    const sourceDay=stamp(p.source_dates['8016']).slice(0,10);
    windows.paid_recent_start=dateOffset(sourceDay,-7);windows.paid_recent_end=dateOffset(sourceDay,-1);
  }
  section.innerHTML=`<div class="section-heading"><h3>重点用户 · 个人证据</h3><span class="caption">重点依据可重叠，结论仍需核查</span></div>${priorityReasons(p)}<div class="priority-profile-facts"><div><span>订单窗口付款</span><b>${p.paid?esc(p.amount_band || '未公开'):'无付款记录'}</b><small>${p.paid?priorityCount(p.payment_orders,' 笔')+' · 公开金额档':'不能据此推断历史从未付款'}</small></div><div><span>近 7 个完整日成功使用</span><b>${p.paid?priorityCount(p.paid_active_days_7,' 天'):'不在当前付款名单'}</b><small>${esc(priorityWindow(windows,'paid_recent_start','paid_recent_end'))}</small></div><div><span>28 日跨天新任务</span><b>${p.in_behavior_top500?priorityCount(p.return_tasks_28,' 个'):'未进入前 500 名单'}</b><small>${p.in_behavior_top500?'期间成功使用 '+priorityCount(p.behavior_active_days_28,' 天'):'不能判断没有重复使用'}</small></div></div><p class="priority-profile-products"><b>实际付款商品</b>${esc(priorityProducts(p))}</p>${evidence.length?`<div class="priority-profile-evidence"><h3>已经观察到什么</h3><ul>${evidence.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div>`:''}${actions.length?`<div class="priority-profile-actions"><h3>下一步核查</h3><ol>${actions.slice(0,2).map(v=>`<li>${esc(v)}</li>`).join('')}</ol>${actions.length>2?`<details><summary>其他命中维度的核查建议（${actions.length-2} 条）</summary><ol>${actions.slice(2).map(v=>`<li>${esc(v)}</li>`).join('')}</ol></details>`:''}<p class="caption">核查建议可在本机版本中跟进。</p></div>`:''}${priorityList(p.limits).length?`<details><summary>这位用户的判断边界</summary><ul>${priorityList(p.limits).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details>`:''}<p class="caption priority-profile-sources">${Object.entries(p.source_dates||{}).map(([id,date])=>`${prioritySource(id)} · ${esc(stamp(date))||'提取时间未记录'}`).join('<br>')}</p>`;
  document.querySelector('#detailBody').prepend(section);
}

;
'use strict';
function evidenceLink(q,label){return `<a href="?view=sources#source-${Number(q)}">${esc(label||'来源 q'+q)}</a>`;}
function sourceCaption(d,q,extra=''){const s=d.sources[String(q)];return `<p class="caption evidence-line">${evidenceLink(q)} · ${s?.fetched_at?esc(stamp(s.fetched_at)):'暂无可用数据'}${s?.state==='retained'?' · 保留旧版':''}${extra?' · '+esc(extra):''}</p>`;}
function percent(n,total){return total?((n/total)*100).toFixed(1)+'%':'—';}
function priorityOverview(p){
 if(!p)return '';
 const ids=['repeat_paid','recent_paid_active','repeat_paid_active','repeat_paid_quiet'];
 const labels=['多次付款','近期多日使用','多次付款且近期多日使用','多次付款但近期静默'];
 return `<div class="insight-lead"><div><span class="tag blue">真实账号 · 可追溯行为</span><h2>哪些人反复回来，<br>又有哪些人值得优先跟进。</h2><p>${fmt(p.summary.paid_users)} 位付款用户、${fmt(p.summary.behavior_top500_count)} 位行为名单用户。按不同证据查看真实名单，再回到具体内容理解他们做的工作。</p></div><div class="lead-action"><button class="primary" data-view="priority" data-priority-group="repeat_paid_active">查看重点用户 →</button><button data-view="work">查看真实任务</button><span>近期使用：${esc(p.windows.paid_recent_start)} — ${esc(p.windows.paid_recent_end)}</span></div></div>
 <div class="metrics persona-metrics">${ids.map((id,i)=>{const g=p.groups.find(x=>x.id===id);return `<button class="metric priority-metric" data-view="priority" data-priority-group="${id}"><span>${labels[i]}</span><strong>${fmt(g.count)} <small>人</small></strong><small>${i===0?'有效付款 ≥2 笔':i===1?'近 7 日付款后使用 ≥2 天':i===2?'两种行为同时满足':'首付早于窗口且近 7 日无成功使用'}</small><span class="caption">查看名单 →</span></button>`;}).join('')}</div>
 <p class="caption">以上分母均为 ${fmt(p.summary.paid_users)} 位付款用户，分组可重叠；多次付款包含积分包和升级，近期静默不等于流失。付款来源更新 ${esc(stamp(p.source_dates['8016']))}。</p>
 <section class="insight-section"><div class="section-heading"><div><h2>具体用户与下一步核查</h2><p class="caption">有意选择不同的行为类型，展示匿名账号与入选理由。</p></div><button data-view="priority">全部重点名单 →</button></div><div class="candidate-grid">${p.examples.slice(0,3).map(u=>`<article class="candidate-card"><div class="candidate-header">${nameCell(u)}${badge(u.example_group?.title||u.priority_reasons[0],'blue')}</div><p>${esc(u.evidence[0])}</p><p>${u.paid?`付款后最近 7 日成功使用 ${u.paid_active_days_7===null?'未知':fmt(u.paid_active_days_7)+' 天'}。`:`28 日使用 ${fmt(u.behavior_active_days_28)} 天，跨天新任务 ${fmt(u.return_tasks_28)} 个。`}</p><div class="action-measure"><b>下一步</b><p>${esc(u.example_group?.action||u.next_actions[0]?.action)}</p></div><button class="text-button" data-user="${esc(u.key)}">查看逐人证据与订单 →</button></article>`).join('')}</div></section>`;
}
function renderInsights(d){
 const root=$('#insightView');
 root.onclick=null;root.oninput=null;root.onchange=null;
 if(state.view==='work'){root.innerHTML=workView(d);renderJobTable(d);renderFeedback(d);return;}
 if(state.view==='actions'){root.innerHTML=actionsView(d);return;}
 const w=d.weekly,c=d.counts,co=d.mature_cohort,j=d.jobs.find(r=>r['内容类型']==='小红书／小绿书'),html=d.jobs.find(r=>r['内容类型']==='网页／HTML');
 root.innerHTML=`${priorityOverview(d.priority)}
 <div class="scope-strip"><b>候选规则可调整</b><span>来源只返回排序前 ${fmt(c.sample)} 人，以上不是全站核心用户总数。</span><div>${d.thresholds.map(x=>`<button class="threshold ${x.days===3?'selected':''}" data-days="${x.days}">≥${x.days} 天：${fmt(x.count)} 人</button>`).join('')}</div></div>
 <section class="insight-section"><div class="section-heading"><h2>现在更值得关注的三个问题</h2><button class="text-button" data-view="actions">查看行动计划 →</button></div><div class="insight-three">
 <article class="insight-card"><span class="insight-index">01 · 重复价值</span><h3>多少人把一次尝试变成了下一次任务？</h3><p>${co?`${co.start} 至 ${co.end} 注册、已观察完整首周的 ${fmt(co.users)} 人中，${fmt(co.returners)} 人回来做过新任务（${percent(co.returners,co.users)}）。`:'成熟注册队列数据暂不可用。'}</p><p class="caption">这是成熟队列中的新任务行为，仍需核查是否是返工，以及产物是否被采用。</p>${sourceCaption(d,8736)}<button data-action="improve_return">查看验证步骤</button></article>
 <article class="insight-card"><span class="insight-index">02 · 工作场景</span><h3>内容生产是值得优先研究的复用方向</h3><p>${j&&html?`小红书／小绿书的 ${fmt(j['产出人数'])} 位产出用户中，${fmt(j['其中回来做新任务的人'])} 位回来做过新任务（${j.return_share}%）；网页为 ${html.return_share}%。`:'按产物类型比较使用与回来做事的信号。'}</p><p class="caption">回来的任务可能是另一类型。这里支持研究优先级，尚未证明“靠内容赚钱”的动机。</p>${sourceCaption(d,8763,'类型之间用户可重复')}<button data-view="work">查看场景与真实任务</button></article>
 <article class="insight-card"><span class="insight-index">03 · 交付质量</span><h3>成功运行后，用户仍可能不满意</h3><p>当前 ${fmt(d.feedback.length)} 条自愿任务评分中，有 ${fmt(d.feedback_low)} 条评分为 1–2 分。可以回到具体任务核查。</p><p class="caption">评分样本不代表全站满意度。优先核查输入、交付格式与修改成本。</p>${sourceCaption(d,8887,'最多返回 200 条')}<button data-low-feedback>查看低评分任务</button></article></div></section>
 <section class="insight-section"><div class="section-heading"><div><h2>具体是谁：从这些账号开始核查</h2><p class="caption">按跨天新任务数排序；付款用于理解商业价值，职业与用途保留待核查。</p></div><button data-view="core">全部 ${fmt(c.priority)} 位候选 →</button></div><div class="candidate-grid">${d.examples.map(u=>`<article class="candidate-card"><div class="candidate-header">${nameCell(u)}${badge(u.order_count?'有付款':'订单窗口无付款',u.order_count?'green':'')}</div><div class="candidate-numbers"><span><b>${fmt(u.active_days)}</b> 天成功使用</span><span><b>${fmt(u.return_tasks)}</b> 个跨天新任务</span></div><p>${u.persona?.job?'已记录工作：'+esc(u.persona.job):u.feedback?.length?'已有任务：'+esc(u.feedback[0]['任务标题']):'具体工作与采用证据尚未关联，需要回看任务。'}</p><div class="tag-row">${badge(u.kind_count==null?'产物类型待核':'累计 '+u.kind_count+' 类产物')}${badge(u.persona?.role||'职业待核')}${badge(u.persona?.core_status==='已验证'?'采用已核实':'实际采用待核',u.persona?.core_status==='已验证'?'green':'')}</div><button class="text-button" data-user="${esc(u.key)}">打开用户档案 →</button></article>`).join('')||'<p class="empty">尚无可用行为名单。请在数据连接检查 q8062。</p>'}</div>${sourceCaption(d,8062,'来源未完整排除内部测试账号，需逐人核查')}</section>
 <section class="insight-section evidence-bottom"><div><h2>五类动机，暂时退回待验证假设</h2><p>“靠内容赚钱、交差或上课、临时办事、表达心意、仍在试用”没有足够的逐人证据，当前不用于给用户自动打标签，也不展示人数占比。先从具体工作归纳需求，再决定如何分群。</p></div><details><summary>哪些证据还缺失</summary><ul>${d.limits.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details></section>`;
}
function workView(d){return `<div class="notice"><span><b>工作用途与实际产物分开统计</b> · 这里看产物来源的首个主类型。内容报告可单独查看每人的任务摘要、用途线索和后台动作。</span><a href="?view=content">查看真实任务</a></div><div class="work-intro"><h2>产物告诉我们“做出了什么”，任务证据帮助理解“为什么做”。</h2><p>以下为每个任务的首个主类型；同一任务后续转格式会遗漏。小红书与小绿书在本来源中合并，不能据此计算两者交集或先后顺序。</p></div>
 <section class="table-panel insight-section"><div class="table-toolbar"><div><h2>真实产出与复用信号</h2><p class="caption">${esc(d.jobs_window.start)} — ${esc(d.jobs_window.end)} · 28 个完整日</p></div><label>排序 <select id="jobSort"><option value="people">产出人数</option><option value="returners">回来做新任务人数</option><option value="share">回来做新任务占比</option></select></label></div><div class="table-scroll natural-table"><table><thead><tr><th>产物类型</th><th>产出人数</th><th>产出任务数</th><th>其中回来做新任务</th><th>占该类型产出用户</th><th>具体任务证据</th></tr></thead><tbody id="jobRows"></tbody></table></div><div class="panel-foot">${sourceCaption(d,8763,'回来的人不一定继续做同类产物；小样本占比不用于排名结论')}</div></section>
 <section class="insight-section"><div class="section-heading"><div><h2>用户实际交给 Prezto 的任务</h2><p class="caption">展示真实评分事件的匿名工作主题、产物类型和用户评分。</p></div></div><div class="feedback-controls"><label class="search"><span class="sr-only">搜索任务标题或用户</span><input id="taskSearch" type="search" placeholder="搜索工作主题、产物类型或匿名编号"></label><label><span class="sr-only">任务评分</span><select id="taskScore"><option value="all">全部评分</option><option value="low">低评分 · 1–2 分</option><option value="high">高评分 · 4–5 分</option></select></label><label><span class="sr-only">产物类型</span><select id="taskType"><option value="">全部产物</option>${[...new Set(d.feedback.map(r=>r['产物类型']))].map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label><span id="taskCount" class="muted"></span></div><div id="taskCards" class="task-grid"></div>${sourceCaption(d,8887,'自愿评分样本，最多 200 条；满意不等于实际采用')}</section>
 <div class="insight-two"><section class="panel"><h2>跨类型工作线索</h2><p class="caption">28 日内活跃者的历史累计主类型组合；不是 28 日内同时使用，也不是类型迁移。同一任务后续转格式尚未计入。</p><div class="combination-list">${d.combinations.map(r=>`<div><span>${esc(r['内容组合'])}</span><b>${fmt(r['使用人数'])} 人</b><small>其中 ${fmt(r['其中回来做新任务的人'])} 人回来做新任务</small></div>`).join('')}</div>${sourceCaption(d,8764)}</section><section class="panel"><h2>当天执行失败线索</h2><p class="caption">只有失败运行的记录；之后成功不代表原问题一定解决。</p>${d.failures.map(r=>`<div class="failure-item"><button class="user-button" data-user="${esc(r.key)}">账号 ${esc(r.key)}</button><p>${esc(r['能力归属'])} · ${esc(r['失败类别'])}</p><span class="caption">${fmt(r['失败次数'])} 次失败 · 之后 ${fmt(r['之后成功运行'])} 次成功</span></div>`).join('')||'<p class="caption">当前来源未返回失败记录。</p>'}${sourceCaption(d,8257)}</section></div>`;}
function renderJobTable(d){const sort=$('#jobSort').value;const key=sort==='share'?'return_share':sort==='returners'?'其中回来做新任务的人':'产出人数';const types={'小红书／小绿书':'xiaohongshu','PPT':'pptx','网页／HTML':'html'};$('#jobRows').innerHTML=[...d.jobs].sort((a,b)=>b[key]-a[key]).map(r=>`<tr><td><b>${esc(r['内容类型'])}</b></td><td>${fmt(r['产出人数'])}</td><td>${fmt(r['产出任务数'])}</td><td>${fmt(r['其中回来做新任务的人'])}</td><td><div class="share-cell"><span class="mini-track"><i style="width:${r.return_share}%"></i></span>${r.return_share}%</div></td><td>${types[r['内容类型']]?`<button class="text-button" data-task-type="${types[r['内容类型']]}">查看评分样本 →</button>`:'暂无同类评分样本'}</td></tr>`).join('');}
function renderFeedback(d){const q=$('#taskSearch').value.toLowerCase(),score=$('#taskScore').value,type=$('#taskType').value;const rows=d.feedback.filter(r=>(!q||[r['任务标题'],r.key,r['产物类型'],r['任务ID']].join(' ').toLowerCase().includes(q))&&(!type||r['产物类型']===type)&&(score==='all'||score==='low'&&r['评分']<=2||score==='high'&&r['评分']>=4));$('#taskCount').textContent=`${rows.length} 条记录`;
 $('#taskCards').innerHTML=rows.map(r=>`<article class="task-card"><div class="section-heading">${badge(r['产物类型'],'blue')}${badge(r['评分']+' / 5 · '+r['满意程度'],r['评分']<=2?'amber':'green')}</div><h3>${esc(r['任务标题']||'标题未记录')}</h3><button class="user-button" data-user="${esc(r.key)}">${esc(r['用户昵称'])} →</button><p>${r['不满意原因']?'用户反馈：'+esc(r['不满意原因']):'具体反馈原文仅在本机可见。'}</p><details><summary>查看证据标识</summary><dl class="facts">${fact('任务 ID',esc(r['任务ID']))}${fact('评分事件 ID',esc(r['评分记录ID']))}</dl></details><div class="caption">${esc(stamp(r['评分时间']))} · ${evidenceLink(8887,'查看评分来源')}</div></article>`).join('')||'<div class="empty"><strong>没有匹配的已评分任务</strong>调整筛选；来源没有返回的任务不能推断为不存在。</div>';
}
function actionsView(d){return `<div class="work-intro"><h2>先补核心用户与真实工作的证据，再决定产品与运营动作。</h2><p>以下是基于当前数据的建议，尚未执行。公开页可阅读行动步骤和验证标准。</p></div><div class="action-grid">${d.actions.map(a=>`<article class="action-card"><div class="section-heading">${badge(a.priority,'blue')}${badge(a.plan.status||'待制定',a.plan.status==='已完成'?'green':'')}</div><h2>${esc(a.title)}</h2><p>${esc(a.basis)}</p><ol>${a.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="action-measure"><b>怎样才算有结果</b><p>${esc(a.measure)}</p></div><div class="caption">${a.source_ids.map(q=>evidenceLink(q)).join(' · ')}</div><div class="action-footer"><span>${a.plan.owner?esc(a.plan.owner):'执行信息仅本机可见'}${a.plan.due?' · '+esc(a.plan.due):''}</span><button data-action="${esc(a.id)}">查看行动计划</button></div></article>`).join('')}</div><section class="panel insight-section"><h2>暂不用于判断的指标</h2><p>首付后使用分组返回 ${fmt(d.payment_followup.source_count)} 人，付款卡返回 ${fmt(d.payment_followup.paid_count)} 人。${d.payment_followup.population_matches?'人数与提取日期一致，仍需遵循各卡观察窗口。':'当前人群未校验一致，不用它推断所有付款用户的留存；需先解释差异。'}</p>${sourceCaption(d,8746)}</section>`;}
function openAction(id){const a=state.insights?.actions.find(x=>x.id===id);if(!a)return;const p=a.plan||{};$('#actionTitle').textContent=a.title;$('#actionBody').innerHTML=`<p>${esc(a.basis)}</p><form id="actionForm" class="review-form"><div class="review-grid"><label>执行状态<select name="status">${['待制定','已计划','进行中','已完成'].map(x=>`<option ${x===(p.status||'待制定')?'selected':''}>${x}</option>`).join('')}</select></label><label>负责人<input name="owner" maxlength="100" value="${esc(p.owner||'')}" placeholder="填写负责人"></label><label>复查日期<input name="due" type="date" value="${esc(p.due||'')}"></label></div><label>具体行动与对象<textarea name="note" maxlength="5000" placeholder="选取哪些账号、核查什么、如何验证…">${esc(p.note||'')}</textarea></label><label>结果与证据<textarea name="outcome" maxlength="5000" placeholder="完成后记录发现、原始证据链接与后续决定">${esc(p.outcome||'')}</textarea></label><div class="save-row"><button type="submit" class="primary">保存行动计划</button><span id="actionSave" role="status" class="caption"></span></div></form>`;$('#actionForm').querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=true);
 $('#actionSave').textContent='公开版只读';$('#actionDialog').showModal();
 $('#actionForm').onsubmit=e=>e.preventDefault();
}
function mountFinding(d){const u=d.user,f=d.finding||{},feedback=u.feedback||[],r=u.sources?.['8062']||d.raw['8062'],win=d.behavior_window;
 const section=document.createElement('section');section.className='persona-detail';section.innerHTML=`<div class="detail-section"><div class="section-heading"><h3>这个用户的画像证据</h3>${badge(f.core_status==='已验证'?'核心用户 · 已验证':f.core_status==='不符合'?'本次核查不符合':'持续价值待验证',f.core_status==='已验证'?'green':'amber')}</div><div class="tag-row">${(u.tags||[]).map(t=>badge(t)).join('')}</div>${r?`<dl class="facts evidence-facts">${fact('28 日成功使用',fmt(u.active_days)+' 天')}${fact('28 日跨天新任务',fmt(u.return_tasks)+' 个')}${fact('28 日新任务',u.new_tasks==null?'未公开':fmt(u.new_tasks)+' 个')}${fact('累计成功任务',u.successful_tasks==null?'未公开':fmt(u.successful_tasks)+' 个')}${fact('累计产物类型',u.kind_count==null?'未公开':fmt(u.kind_count)+' 类（具体类型未返回）')}${fact('最近成功使用',shown(u.behavior_last_used))}</dl><p class="caption">${esc(win.start)} — ${esc(win.end)} · ${evidenceLink(8062)} · 不是逐日任务时间线；不同任务 ID 仍可能属于同一工作或返工。</p>`:'<p class="caption">该用户未出现在 q8062 的前 500 人名单内。不能据此判断没有重复使用。</p>'}${feedback.length?`<h3>已关联的真实任务与反馈</h3>${feedback.map(x=>`<div class="detail-task"><b>${esc(x['任务标题'])}</b><span>${esc(x['产物类型'])} · ${x['评分']} / 5 · ${esc(x['不满意原因']||'未填写原因')}</span><small>${esc(x['任务ID'])} · 评分事件 ${esc(x['评分记录ID'])}</small></div>`).join('')}`:'<p class="caption">暂无已连接的任务标题或评分；不要根据昵称、渠道或付款金额推测其职业。</p>'}</div>
 <section class="detail-section"><h3>核查具体工作与持续价值</h3><p class="caption">填写来自任务、访谈或交付记录的事实；行业和职位须附原始证据链接，并纳入大盘的已识别覆盖。将其标为“已验证”需要工作、采用、复用原因和原始链接。</p><form id="findingForm" class="review-form"><div class="review-grid"><label>核心用户核查<select name="core_status">${['待核查','已验证','不符合'].map(s=>`<option ${s===(f.core_status||'待核查')?'selected':''}>${s}</option>`).join('')}</select></label><label>行业（有证据再填）<input name="industry" maxlength="500" value="${esc(f.industry||'')}" placeholder="来自用户明确自述或档案"></label><label>职位 / 角色（有证据再填）<input name="role" maxlength="500" value="${esc(f.role||'')}" placeholder="例如用户自述的工作角色"></label></div><label>具体要完成的工作<input name="job" maxlength="1000" value="${esc(f.job||'')}" placeholder="在什么情境下，为谁做什么，怎样算完成"></label><label>最终怎样采用了结果<textarea name="adoption" maxlength="5000" placeholder="发布、交付、上课、汇报等实际采用证据；未确认就留空">${esc(f.adoption||'')}</textarea></label><label>为什么会再次使用<textarea name="repeat_reason" maxlength="5000" placeholder="真实任务频率、复用步骤；区分新工作与原任务返工">${esc(f.repeat_reason||'')}</textarea></label><label>原始证据链接<input name="evidence" type="url" maxlength="1000" value="${esc(f.evidence||'')}" placeholder="任务、访谈或已采用产物的链接"></label><label>其他观察与待确认事项<textarea name="note" maxlength="5000" placeholder="付款动机、体验阻碍、是否内部测试等">${esc(f.note||'')}</textarea></label><div class="save-row"><button class="primary" type="submit">保存用户画像</button><span id="findingSave" role="status" class="caption">${f.updated_at?'上次保存 '+esc(stamp(f.updated_at)):''}</span></div></form></section>`;
 if(f.other_findings?.length){const history=document.createElement('details');history.className='detail-section';history.innerHTML=`<summary>另有 ${f.other_findings.length} 份历史身份下的档案${f.needs_resolution?' · 内容冲突待核查':''}</summary><p class="caption">以下证据完整保留。当前表单显示最近更新的一份；可选择历史档案继续编辑。</p>${f.other_findings.map((r,i)=>`<article class="detail-task"><b>${esc(r.core_status)} · ${esc(stamp(r.updated_at))}</b><p>工作：${esc(r.job)}<br>行业：${esc(r.industry)}<br>角色：${esc(r.role)}<br>采用：${esc(r.adoption)}<br>复用原因：${esc(r.repeat_reason)}<br>证据：${esc(r.evidence)}<br>笔记：${esc(r.note)}</p><button type="button" data-finding-history="${i}">编辑这份档案</button></article>`).join('')}`;section.prepend(history);history.querySelectorAll('[data-finding-history]').forEach(button=>button.onclick=()=>{const chosen=f.other_findings[Number(button.dataset.findingHistory)];const others=[f,...f.other_findings.filter(r=>r.record_key!==chosen.record_key)].map(({other_findings,...r})=>r);d.finding={...chosen,other_findings:others,needs_resolution:f.needs_resolution};renderDetail(d);});}
 $('#detailBody').prepend(section);
 section.querySelectorAll('#findingForm input,#findingForm select,#findingForm textarea,#findingForm button').forEach(control=>control.disabled=true);
 $('#findingSave').textContent='公开版只读';$('#findingForm').onsubmit=e=>e.preventDefault();
}
document.addEventListener('change',e=>{if(e.target.id==='jobSort')renderJobTable(state.insights);if(['taskScore','taskType'].includes(e.target.id))renderFeedback(state.insights);});
document.addEventListener('input',e=>{if(e.target.id==='taskSearch')renderFeedback(state.insights);});
document.addEventListener('click',async e=>{const action=e.target.closest('[data-action]'),days=e.target.closest('[data-days]'),type=e.target.closest('[data-task-type]');if(action){openAction(action.dataset.action);return;}if(days){setView('core');$('#coreDays').value=days.dataset.days;load();return;}if(type){$('#taskType').value=type.dataset.taskType;renderFeedback(state.insights);$('#taskCards').scrollIntoView({block:'start'});return;}if(e.target.closest('[data-low-feedback]')){setView('work');await load();if(state.view==='work'&&$('#taskScore')){$('#taskScore').value='low';renderFeedback(state.insights);$('#taskCards').scrollIntoView({block:'start'});}return;}if(e.target.id==='closeAction')$('#actionDialog').close();});
function renderEvidenceSources(){
 const m=state.meta,v=m.manifest.validation,d=state.insights;
 const scope={7996:'可见注册记录和累计行为，排除源 SQL 指定昵称及 NULL 昵称。',8004:`有效付款订单 ${m.payment_start} 至 ${m.payment_end}；非净收入。`,8016:'付款用户，最近 7 个完整日成功使用；逐人金额与订单数已核对。',8062:'最近 28 个完整日，按跨天新任务排序前 500 人；不是全站或随机样本。',8763:'最近 28 个完整日产物类型；用户跨类型重复。',8765:'每日滚动 7 天成功使用人数与使用 ≥2 / ≥3 天人数。',8887:'自愿评分事件，最多 200 条；带明确用户 ID、账号码、任务和运行标识。',8736:'注册队列首周；只计算已经观察完整 7 天的用户。',8746:'首付后完整 7 天使用分布；须先核对是否与付款卡人群一致。',8257:'提取当日失败运行；不是全历史故障率。',8775:'历史月费用户、提取时权益与滚动 7 天使用。',8816:'月费关注名单，含明确 ID 对照。',8776:'月费原卡实付、退款及有效会员指标。',8822:'提取时有效月费会员的使用状态。',8817:'月费运营卡质量核查。'};
 const errors=m.manifest.errors||{};
 $('#sourceView').innerHTML=`<div class="source-grid"><section class="panel"><h2>按来源更新，保留真实日期</h2><p>用户、订单与付款汇总必须整组成功并通过校验。月费卡作为独立组更新；任一卡失败，整组保留原数据和原日期。其他画像证据独立标记更新时间。</p><p class="caption">各卡独立查询，不是跨表事务快照。同步使用已有只读卡片，不修改共享 SQL；凭据只留在本机服务端。</p><p>当前版本：<b>${esc(m.snapshot)}</b><br>组装完成：${esc(stamp(m.manifest.finished_at))}</p><button data-view="overview">返回画像总览</button></section><section class="panel"><h2>身份连接与金额核对</h2><div class="integrity"><div><span>唯一订单</span><b>${fmt(v.unique_orders)}</b></div><div><span>逐人订单校验</span><b>${fmt(v.paid_users_reconciled)} / ${fmt(m.counts.paid)}</b></div></div><p>付款用户连接注册：${fmt(v.paid_linked_to_registration)} / ${fmt(m.counts.paid)}<br>明确 ID 对照：${fmt(v.identity_rows)} 组</p><p class="caption">只使用 q8816、q8887 和已保存的明确用户 ID／账号码对照。不按昵称猜测身份。行为名单通过账号码连接付款，无法连接注册的账号仍单独展示。</p></section></div>
 ${Object.keys(errors).length?`<section class="panel insight-section" style="margin-top:20px"><h2>本次未能刷新的来源</h2><p>这些来源读取失败。保留的数据仍可查看，但不是本次最新数据。</p><ul>${Object.entries(errors).map(([id,msg])=>`<li>${evidenceLink(id)} · ${esc(msg)}</li>`).join('')}</ul></section>`:''}
 <section class="table-panel source-list"><div class="table-toolbar"><h2>逐项数据与新鲜度</h2><span class="muted">保留旧版不等于同步成功</span></div><div class="table-scroll natural-table"><table><thead><tr><th>来源</th><th>记录数</th><th>提取时间 / 状态</th><th>范围与限制</th></tr></thead><tbody>${Object.entries(m.manifest.sources).map(([id,x])=>`<tr id="source-${esc(id)}"><td>${evidenceLink(id,x.name||'q'+id)}<div class="cell-sub">q${esc(id)}</div></td><td>${fmt(x.rows)}</td><td>${esc(stamp(x.fetched_at))}<div class="source-state">${badge(x.state==='retained'?'保留旧版':'本版已读取',x.state==='retained'?'amber':'green')}</div></td><td style="white-space:normal;min-width:230px">${esc(scope[id]||'遵循来源卡自身窗口。')}</td></tr>`).join('')}</tbody></table></div></section>
 <div class="source-grid" style="margin-top:20px"><section class="panel"><h2>仍缺少的用户证据</h2><ul>${(d?.limits||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>当前只读权限不支持任意 SQL 查询；需要数据源提供完整 ID 对照和按用户查询的任务、产物及实际采用事件。</p></section><section class="panel"><h2>首付后使用分组暂不作全体结论</h2><p>q8746 返回 ${fmt(d?.payment_followup.source_count)} 人，付款卡为 ${fmt(m.counts.paid)} 人。${d?.payment_followup.population_matches?'人数与提取日期一致，分析时仍需核对观察窗口。':'差异尚未解释，不据此判断所有付款用户的留存。'}</p><h2>月费原卡指标</h2><dl class="facts">${m.monthly_metrics.map(r=>`<div><dt>${esc(r.metric)}</dt><dd>${fmt(r.value)} ${esc(r.unit)}</dd></div>`).join('')}</dl><p class="caption">提取于 ${esc(stamp(m.manifest.sources['8776']?.fetched_at))}</p></section></div>`;

 const sourceAnchor = /^#source-\d+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
 if(sourceAnchor) requestAnimationFrame(()=>sourceAnchor.scrollIntoView({block:'center'}));
}

;
// Read adapter for the original list, order and modal renderers.
(() => {
  const bands={'低于100元':[0,99],'100–499元':[100,499],'500–999元':[500,999],'1000元及以上':[1000,null]};
  const reverseSegments=()=>Object.fromEntries(Object.entries(state.meta.segments).map(([k,v])=>[v,k]));
  const groupBy=(items,key)=>{
    const groups=new Map();
    for(const x of items){const k=key(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
    return groups;
  };
  let index;
  async function publicIndex(){
    const data=await window.publicLoad('people');
    if(index?.data===data)return index;
    const users=new Map(data.people.map(x=>[x.id,x]));
    const orders=data.orders.map((o,i)=>({...o, id:'订单 '+(i+1), key:o.user, name:o.user, code:null, user_id:o.user, paid_at:o.month,
      sequence:o.kind==='首次付款'?1:null, source:users.get(o.user)?.paid_source||'未标记来源',channel:'公开订单'}));
    index={data, users,orders,byUser:groupBy(orders,o=>o.user)};
    return index;
  }
  function amounts(orders){
    if(!orders.length)return {amount_band:'未连接',band_low:null};
    if(orders.length===1)return {amount_band:orders[0].amount_band,band_low:bands[orders[0].amount_band]?.[0]??null};
    let low=0,high=0;
    for(const o of orders){
      const b=bands[o.amount_band];if(!b)return {amount_band:'未公开',band_low:null};
      low+=b[0];high=high===null||b[1]===null?null:high+b[1]+1;
    }
    return {amount_band:high===null?'¥'+fmt(low)+' 起':'¥'+fmt(low)+' 至 < ¥'+fmt(high),band_low:low};
  }
  function person(row, list, view, seg){
    const orders=list.byUser.get(row.id)||[], months=orders.map(o=>o.month).sort();
    const linked_sources=[];
    for(const [v,k] of Object.entries({registered:'7996',paid:'8016',monthly:'8775',attention:'8816'}))if(row.views.includes(v))linked_sources.push(k);
    if(row.active_days!=null)linked_sources.push('8062');
    const source=view==='paid'?row.paid_source:row.source;
    return {...row,...amounts(orders),key:row.id,name:row.id,user_id:row.id,linked_sources,source,behavior_source:row.source,payment_source:row.paid_source,
      registered_at:row.registered_month, first_paid:months[0], last_paid:months.at(-1),
      paid_cents:null,monthly_active_days:row.monthly_active_days??null,paid_active_days:row.paid_active_days??null,
      review:'未公开',attention:row.views.includes('attention')?'运营关注名单':null,remaining_days:null,segment:seg[row.segment],
      tags:list.data.groups.filter(g=>row.groups.includes(g.id)).map(g=>g.title)};
  }
  function page(rows, params, all){
    const size=Math.min(100,Math.max(1,parseInt(params.get('size'),10)||25));
    const p=Math.max(1,Math.min(Math.ceil(rows.length/size),parseInt(params.get('page'),10)||1));
    return {total:rows.length,page:p,size,rows:all?rows:rows.slice((p-1)*size,p*size)};
  }
  function taskBand(n){return n==null?'unknown':n===0?'zero':n===1?'one':n<=4?'two_four':n<=9?'five_nine':'ten_plus';}
  function monthMatches(month,params){
    const start=params.get('from')?.slice(0,7),end=params.get('to')?.slice(0,7);
    return (!start||Boolean(month&&month>=start))&&(!end||Boolean(month&&month<=end));
  }
  const contains=(x,q)=>String(x??'').toLowerCase().includes(q);
  function orderResult(list,params,all,agg){
    const q=(params.get('q')||'').trim().toLowerCase();
    const rows=list.orders.filter(o=>monthMatches(o.month,params)&&(!params.get('product')||o.product===params.get('product'))&&
      (!params.get('source')||o.source===params.get('source'))&&(!q||[o.id,o.user,o.product].some(v=>contains(v,q))));
    const totalCents=rows.length===list.orders.length?agg.totalCents:null;
    const daily=[...groupBy(rows,o=>o.month)].sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date,orders:v.length}));
    const products=[...groupBy(rows,o=>o.product)].map(([product,v])=>({product,orders:v.length})).sort((a,b)=>b.orders-a.orders);
    const globalScope=!q&&!params.get('source')&&!params.get('product');
    const fullMonths=!params.get('from')&&!params.get('to');
    const exactDays=globalScope?agg.daily.filter(x=>monthMatches(x.date.slice(0,7),params)):null;
    const exactProducts=globalScope&&fullMonths?agg.products:null;
    return {...page(rows,params,all),daily,products,exactDays,exactProducts,summary:{cents:totalCents,orders:rows.length,buyers:new Set(rows.map(o=>o.user)).size,
      first_buyers:new Set(rows.filter(o=>o.kind==='首次付款').map(o=>o.user)).size}};
  }
  function userResult(list,params,all,agg){
    const view=params.get('population')||'paid',q=(params.get('q')||'').trim().toLowerCase(),seg=reverseSegments();
    const rows=list.data.people.filter(u=>{
      if(view==='core')return u.active_days!=null&&u.return_tasks!=null&&u.active_days>=Number(params.get('min_days')??3)&&
        u.return_tasks>=Number(params.get('min_returns')??2)&&(!params.get('paid')||u.views.includes('paid')===(params.get('paid')==='yes'));
      return u.views.includes(view);
    }).map(u=>person(u,list,view,seg)).filter(u=>{
      const activity=params.get('activity');
      if(activity==='2+'&&!(u.paid_active_days>=2))return false;
      if(activity&&activity!=='2+'&&u.paid_active_days!==Number(activity))return false;
      for(const k of ['source','segment','usage','review'])if(params.get(k)&&params.get(k)!==u[k])return false;
      if(params.get('tasks_bucket')&&params.get('tasks_bucket')!==taskBand(u.tasks))return false;
      if(q&&![u.id,u.source].some(v=>contains(v,q)))return false;
      const date=view==='registered'?u.registered_at:view==='paid'?u.first_paid:null;
      return monthMatches(date,params);
    });
    let sort=params.get('sort')||({registered:'registered_at',paid:'band_low',core:'return_tasks'}[view]||'name');
    if(sort==='paid_cents')sort='band_low';
    const asc=params.get('direction')==='asc'?1:-1;
    rows.sort((a,b)=>{const x=a[sort],y=b[sort];if(x==null||y==null)return x==null&&y==null?a.id.localeCompare(b.id):x==null?1:-1;return ((x>y)-(x<y))*asc||a.id.localeCompare(b.id);});
    const tally=fn=>rows.filter(fn).length;
    return {...page(rows,params,all),summary:{total:rows.length,with_tasks:tally(u=>u.tasks>0),with_artifacts:tally(u=>u.artifacts>0),
      paid:tally(u=>['已付款','有月付记录'].includes(u.payment_status)),paid_cents:view==='paid'&&rows.length===list.data.counts.paid?agg.totalCents:null,
      attention:tally(u=>u.attention),effective_monthly:tally(u=>u.membership==='有效月会员'),inactive_paid:tally(u=>u.paid_active_days===0),inactive_monthly:tally(u=>u.monthly_active_days===0)}};
  }
  async function detail(list,key){
    const [content,priority]=await Promise.all(['content','priority'].map(name=>window.publicLoad(name)));
    const profile=content.profiles[key],p=list.users.get(key);
    if(!p&&!profile)throw new Error('公开快照中没有这个账号');
    const user=p?person(p,list,'',reverseSegments()):{id:key,name:key,key,user_id:key,linked_sources:[],tags:[],review:'未公开'};
    user.feedback=(state.insights?.feedback||[]).filter(row=>row.key===key);
    user.tags=user.tags||[];
    const raw={};
    if(p?.views.includes('registered'))raw['7996']={'注册月份':p.registered_month,'公开来源':p.source,'累计任务数':p.tasks,'产物记录数':p.artifacts};
    if(p?.views.includes('monthly'))raw['8775']={'会员状态':p.membership,'使用状态':p.usage,'近7天活跃天数':p.monthly_active_days??null};
    if(p?.active_days!=null)raw['8062']={'期间使用天数':p.active_days,'其中回来做的新任务':p.return_tasks};
    if(p?.views.includes('paid'))raw['8016']={'关联订单笔数':p.order_count,'付款后近7日使用天数':p.paid_active_days??null};
    const tasks=profile?content.tasks.filter(t=>t.user_key===key):[];
    return {user,raw,snapshot:state.meta.manifest.finished_at,orders:list.byUser.get(key)||[],behavior_window:state.insights?.window||{},
      priority:priority.profiles[key],priority_windows:priority.windows, finding:p?.views.includes('verified')?{core_status:'已验证'}:{},
      content:{profile:profile?{...profile,tasks}:null,batch:content.batch},payment_end:state.meta.payment_end,
      source_dates:Object.fromEntries(Object.entries(state.meta.manifest.sources).map(([k,v])=>[k,v.fetched_at]))};
  }
  window.publicBusinessApi=async function(path,params,all=false){
    const url=new URL(path,'https://public.invalid');
    params=params==null?url.searchParams:new URLSearchParams(params);
    const list=await publicIndex();
    if(url.pathname.startsWith('/api/user/'))return detail(list,decodeURIComponent(url.pathname.slice('/api/user/'.length)));
    const agg=await window.publicLoad('business');
    return url.pathname==='/api/orders'?orderResult(list,params,all,agg):userResult(list,params,all,agg);
  };
  window.exportPublicList=async function(){
    const orders=state.view==='orders',q=filters(),result=await window.publicBusinessApi(orders?'/api/orders':'/api/users',q,true);
    const cols=orders?{id:'公开序号',user_id:'公开账号',paid_at:'付款月份',product:'商品',kind:'类型',amount_band:'金额区间'}:
      {user_id:'公开账号',registered_at:'注册月份',source:'来源',tasks:'累计任务',artifacts:'累计产物',payment_status:'付款记录',order_count:'订单笔数',membership:'会员状态',active_days:'28日成功使用天数',return_tasks:'跨天新任务'};
    const safe=v=>'"'+String(v??'').replace(/^([=+@\-\t\r])/,"'$1").replace(/"/g,'""')+'"';
    const csv=[Object.values(cols),...result.rows.map(r=>Object.keys(cols).map(k=>r[k]))].map(row=>row.map(safe).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');
    a.href=url;a.download='Prezto-'+state.view+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.publicOrderCharts=function(d){
    const max=Math.max(1,...d.daily.map(x=>x.orders));
    $('#dailyChart').innerHTML=d.daily.map(x=>`<button class="day-bar" data-day="${esc(x.date)}" title="${esc(x.date)} · ${fmt(x.orders)} 笔"><span class="bar-money">${fmt(x.orders)}</span><span class="bar-fill" style="height:${Math.max(2,Math.round(x.orders/max*100))}px"></span><span>${esc(x.date)}</span></button>`).join('')||'<p class="caption">当前筛选没有付款记录。</p>';
    $('#productChart').innerHTML=d.products.map(x=>`<button class="product-row" data-product="${esc(x.product)}"><span>${esc(x.product)}</span><span>${fmt(x.orders)} 笔</span><span class="track"><span style="width:${x.orders/d.summary.orders*100}%"></span></span></button>`).join('')||'<p class="caption">当前筛选没有付款记录。</p>';
    const chart=$('#dailyChart').closest('.panel'),note=chart.querySelector('.caption'),heading=chart.querySelector('h2');
    heading.textContent='每月付款订单';note.textContent='点击月份查看对应订单。';$('#resetRange').textContent='全部月份';
    if(d.exactDays?.length){
      const end=$('#dateTo').value ? new Date(Number($('#dateTo').value.slice(0,4)),Number($('#dateTo').value.slice(5)),0).getDate() : null;
      const limitDate=end?$('#dateTo').value+'-'+end:state.meta.payment_end;
      const through=limitDate<state.meta.payment_end?limitDate:state.meta.payment_end;
      const rangeStart=$('#dateFrom').value?$('#dateFrom').value+'-01':dateOffset(through,-13);
      const start=rangeStart>dateOffset(through,-30)?rangeStart:dateOffset(through,-30);
      const byDate=new Map(d.exactDays.map(row=>[row.date,row])),days=[];
      for(let date=start;date<=through;date=dateOffset(date,1))days.push(byDate.get(date)||{date,orders:0,cents:0});
      const ceiling=Math.max(1,...days.map(row=>row.cents||0));
      const detailText=row=>row.date+' · '+fmt(row.orders)+' 笔 · '+(row.cents==null?'少量订单的金额未公开':money(row.cents));
      $('#dailyChart').innerHTML=days.map((row,i)=>`<button type="button" class="day-bar" data-public-bar="${i}" title="${esc(detailText(row))}" aria-label="${esc(detailText(row))}"><span class="bar-money">${row.cents==null?'—':row.cents?fmt(Math.round(row.cents/100)):''}</span><span class="bar-fill" style="height:${Math.max(2,Math.round((row.cents||0)/ceiling*100))}px"></span><span>${esc(row.date.slice(5))}</span></button>`).join('');
      heading.textContent='每日付款金额';note.textContent='点一天查看汇总；当日不足 5 笔只展示笔数。订单明细按月查看。';
      $('#dailyChart').onclick=e=>{const bar=e.target.closest('[data-public-bar]');if(bar)note.textContent=detailText(days[Number(bar.dataset.publicBar)]);};
    }
    if(d.exactProducts?.length){
      $('#productChart').innerHTML=d.exactProducts.map(row=>`<button class="product-row" data-product="${esc(row.product)}"><span>${esc(row.product)} · ${fmt(row.orders)} 笔</span><span>${row.cents==null?'金额未公开':money(row.cents)}</span><span class="track"><span style="width:${100*(row.cents||0)/(d.summary.cents||1)}%"></span></span></button>`).join('');
    }
  };
  window.publicListControls=function(view){
    const monthlyDates=['registered','orders','paid'].includes(view);
    for(const id of ['dateFrom','dateTo']){$('#'+id).type='month';$('#'+id).disabled=!monthlyDates;}
    $('#dateLabel').textContent=({registered:'注册月份',orders:'付款月份',paid:'首次付款月份'}[view]||'日期未公开');
    $('#review').disabled=true;$('#review').title='个人复盘进度未公开';
    const blocked=new Set(['behavior_last_used','remaining_days']);
    for(const o of $('#sort').options){
      const k=o.value.split(':')[0];o.disabled=blocked.has(k);
      if(k==='paid_cents')o.textContent='累计付款区间下限从高到低';
      if(k==='name')o.textContent='按公开账号排序';
    }
    if(blocked.has($('#sort').value.split(':')[0]))$('#sort').value='name:asc';
  };
})();

;
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v||0).toLocaleString('zh-CN');
const money=c=>'¥'+(Number(c||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const shown=v=>v===null||v===undefined||v===''?'未记录':esc(v);
const stamp=s=>{const value=String(s||'');if(/(?:Z|[+-]\d\d:\d\d)$/.test(value)){const d=new Date(value);if(!Number.isNaN(+d))return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}return value.replace('T',' ').slice(0,16);};
const day=s=>s?esc(s.slice(0,10)):'未记录';
const badge=(s,t='')=>`<span class="tag ${t}">${esc(s||'未连接')}</span>`;
const config={
 content:{title:'用户用 Prezto 做什么',subtitle:'从后台任务、工作主题和后续动作，理解真实工作。'},
 population:{title:'Prezto 用户大盘',subtitle:'整体规模、使用频次、任务深度，以及行业与职位的证据覆盖。'},
 overview:{title:'用户研究与重点线索',subtitle:'从真实工作、重复使用和采用证据，逐步识别核心用户。'},
 priority:{title:'重点用户',subtitle:'多次付款、反复使用、商业价值与近期静默；同一用户可以属于多个维度。'},
 core:{title:'核心用户候选',subtitle:'可调整规则、查看真实账号、核对任务与付款。候选不等于已验证的核心用户。',date:'最近成功使用日期',sort:'return_tasks:desc',table:'真实用户 · 研究优先名单'},
 work:{title:'他们用 Prezto 完成什么',subtitle:'先看产物与具体任务，再判断需求；任务格式不会自动变成职业或动机标签。'},
 actions:{title:'接下来做什么',subtitle:'把观察转成可追踪的验证行动：对象、负责人、期限和结果。'},
 verified:{title:'已验证用户档案',subtitle:'来自已填写具体工作、实际采用、复用原因与原始证据的用户档案。',date:'',sort:'name:asc',table:'已验证的用户与具体工作'},
 paid:{title:'付款用户',subtitle:'按公开账号查看付款、最近使用与订单记录。',date:'首次付款日期',sort:'paid_cents:desc',table:'付款用户明细'},
 registered:{title:'全部注册用户',subtitle:'查看可见注册用户的累计任务、产物和来源，逐人核对行为。',date:'注册日期',sort:'registered_at:desc',table:'注册用户明细'},
 monthly:{title:'月费会员',subtitle:'查看会员权益、使用状态与到期日，定位需要复盘的具体用户。',date:'首次月付日期',sort:'remaining_days:asc',table:'月费用户明细'},
 attention:{title:'重点关注',subtitle:'来自月会员运营卡的待关注用户，可逐人记录复盘结果。',date:'首次月付日期',sort:'remaining_days:asc',table:'关注用户明细'},
 orders:{title:'订单流水',subtitle:'按付款时间查订单；每日金额、商品构成与明细来自同一组记录。',date:'付款日期',table:'付款订单明细'},
 sources:{title:'数据连接',subtitle:'查询时间、业务窗口、关联覆盖与同步结果。'}
};
const state={view:'population',page:1,size:25,meta:null,result:null,seq:0,detail:null,syncTimer:null,toastTimer:null};
const initial=new URLSearchParams(location.search);
if(config[initial.get('view')])state.view=initial.get('view');
if(initial.get('view')==='profile')state.view='registered';
'use strict';
const savedResponses = new Map();
window.publicLoad = function publicLoad(name) {
  if (!savedResponses.has(name)) {
    const url = new URL(name + '.json', location.href);
    url.searchParams.set('v', document.documentElement.dataset.release);
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error('读取公开快照失败，请刷新重试');
      return response.json();
    }).catch(error => { savedResponses.delete(name); throw error; });
    savedResponses.set(name, request);
  }
  return savedResponses.get(name);
};
async function api(path, options={}) {
  if (options.method && options.method!=='GET') throw new Error('公开快照仅供查看');
  const url = new URL(path, location.origin);
  const name = url.pathname.slice(5);
  if (['meta','population','insights','priority','content'].includes(name)) return publicLoad(name);
  if (name==='sync') return {state:'idle'};
  return window.publicBusinessApi(url.pathname, url.searchParams);
}

function error(message){$('#error').textContent=message||'';$('#error').hidden=!message;}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
function options(id,list,label){const value=$(id).value;$(id).innerHTML=`<option value="">${esc(label)}</option>`+list.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('');$(id).value=value;}
function dateOffset(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function latestRange(){return [dateOffset(state.meta.payment_end,-13),state.meta.payment_end];}
function setRangeLatest(){$('#dateFrom').value='';$('#dateTo').value='';}
function renderMeta(){
 const m=state.meta;Object.entries(m.counts).forEach(([k,v])=>{const el=$(`[data-count="${k}"]`);if(el)el.textContent=fmt(v);});
 options('#source',m.sources.map(x=>[x,x]),'全部来源');options('#segment',Object.entries(m.segments),'全部行为');options('#usage',m.usage_states.map(x=>[x,x]),'全部使用状态');options('#product',m.products.map(x=>[x,x]),'全部商品');
 const age=Math.floor((Date.now()-Date.parse(m.manifest.finished_at))/86400000);const fresh=age<1&&m.manifest.mode==='queried_metabase_cards';
 $('#freshness').className='notice'+(fresh?' current':'');
 const monthly=m.manifest.sources['8775'],partial=Object.values(m.manifest.groups||{}).some(g=>g.state!=='fresh');
 if(partial)$('#freshness').className='notice';
 $('#freshness').innerHTML=`<span>用户与订单更新于 <b>${esc(stamp(m.manifest.sources['7996']?.fetched_at||m.manifest.finished_at))}</b> · 订单截至 ${esc(m.payment_end)}${partial?`。部分来源未更新；月费${monthly?'仍为 '+esc(stamp(monthly.fetched_at)):'暂无可用数据'}。`:''}</span><button class="text-button" data-view="sources">同步与覆盖</button>`;
 $('#syncTime').textContent=(partial?'部分来源待更新 · ':'')+stamp(m.manifest.finished_at);
}
function filters(){
 const p=new URLSearchParams({page:state.page,size:state.size});
 if(state.view!=='orders')p.set('population',state.view);
 if(state.view==='core'){p.set('min_days',$('#coreDays').value);p.set('min_returns',$('#coreReturns').value);if($('#corePaid').value)p.set('paid',$('#corePaid').value);}
 for(const [id,key] of [['search','q'],['source','source'],['dateFrom','from'],['dateTo','to']])if($('#'+id).value)p.set(key,$('#'+id).value);
 if(state.view==='paid'&&$('#activity').value)p.set('activity',$('#activity').value);
 if(state.view==='registered'&&$('#segment').value)p.set('segment',$('#segment').value);
 if(state.view==='registered'&&$('#tasksBucket').value)p.set('tasks_bucket',$('#tasksBucket').value);
 if(['monthly','attention'].includes(state.view)&&$('#usage').value)p.set('usage',$('#usage').value);
 if(state.view==='orders'){if($('#product').value)p.set('product',$('#product').value);}
 else {if($('#review').value)p.set('review',$('#review').value);const [sort,direction]=$('#sort').value.split(':');p.set('sort',sort);p.set('direction',direction);}
 return p;
}
function saveURL(){const p=['sources','population','content','priority','overview','work','actions'].includes(state.view)?new URLSearchParams():filters();p.delete('population');if(state.view==='content'&&typeof contentURLFilters==='function')contentURLFilters(p);p.set('view',state.view);history.replaceState(null,'','?'+p);}
function metric(label,value,hint){return `<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-hint">${esc(hint)}</div></div>`;}
function renderMetrics(s){
 let cards=[];
 if(state.view==='verified')cards=[['已验证档案',fmt(s.total),'当前筛选中的用户'],['另有冲突档案',fmt(state.insights?.finding_conflicts||0),'全库统计 · 详情保留每份历史证据'],['识别依据','真实采用','不是按付款或访问次数自动认证'],['维护方式','逐人核查','点击用户查看证据']];
 else if(state.view==='core')cards=[['符合当前规则',fmt(s.total),'在来源前 500 人名单内筛选'],['订单窗口有付款',fmt(s.paid),'付款用于理解商业价值，不定义核心'],['已验证持续价值',fmt(state.insights?.counts.verified||0),'来自有采用与复用证据的档案 · 全库'],['职业与任务目的','待补证据','点击账号查看具体工作档案']];
 else if(state.view==='orders')cards=[['付款订单金额',s.cents==null?'按金额区间展示':money(s.cents),'当前筛选 · 未扣全产品退款'],['付款订单',fmt(s.orders),'按订单编号去重'],['付款用户',fmt(s.buyers),'当前范围内账号码去重'],['首次付款用户',fmt(s.first_buyers),'有效付款序列 = 1']];
 else if(state.view==='paid')cards=[['付款用户',fmt(s.total),'符合当前筛选'],['累计订单金额',s.paid_cents==null?'按金额区间展示':money(s.paid_cents),'订单窗口内金额 · 非净收入'],['近 7 个完整日未使用',fmt(s.inactive_paid),'仅指成功使用记录为 0 天'],['已连接月费关注记录',fmt(s.attention),'通过明确 ID 对照关联']];
 else if(['monthly','attention'].includes(state.view))cards=[['月费用户',fmt(s.total),'符合当前筛选 · 含历史状态'],['有效月会员',fmt(s.effective_monthly),'会员状态 = 有效月会员'],['滚动 7 天未活跃',fmt(s.inactive_monthly),'月费卡 · 成功活跃天数 = 0'],['重点关注',fmt(s.attention),'运营卡列出的具体用户']];
 else cards=[['可见注册用户',fmt(s.total),'符合当前筛选'],['有任务记录',fmt(s.with_tasks),'累计任务数 > 0'],['有产物记录',fmt(s.with_artifacts),'产物记录不代表实际采用'],['已确认有付款记录',fmt(s.paid),'未连接账户不计为未付款']];
 $('#metrics').innerHTML=cards.map(c=>metric(...c)).join('');
}
function nameCell(r){return `<div class="name-cell"><button class="user-button" data-user="${esc(r.key)}" title="${esc(r.name)}">${esc(r.name==='未填写昵称'?'账号 '+(r.code||r.user_id):r.name)}</button><div class="cell-sub">${'公开账号'}</div></div>`;}
function activityTag(v){return v===null?badge('未连接'):badge(`${v} 天`,v===0?'amber':'green');}
function reviewTag(r){return badge(r.review||'未复盘',r.review==='已核查'?'green':r.review==='待核查'?'amber':'');}
function renderTable(d){
 let heads=[],rows=[];
 if(state.view==='verified'){
  heads=['用户','具体工作','角色','采用与复用','证据状态'];
  rows=d.rows.map(r=>`<tr><td>${nameCell(r)}</td><td style="white-space:normal;min-width:200px">${esc(r.persona?.job)}</td><td>${shown(r.persona?.role)}</td><td style="white-space:normal;min-width:220px">${esc(r.persona?.adoption)}<div class="caption">${esc(r.persona?.repeat_reason)}</div></td><td>${badge(r.persona?.needs_resolution?'另有冲突档案待核':'已验证',r.persona?.needs_resolution?'amber':'green')}</td></tr>`);
 }else if(state.view==='core'){
  heads=['真实账号','已观察到的特征','28 日使用','跨天新任务','付款记录','最近成功使用','复盘'];
  rows=d.rows.map(r=>`<tr><td>${nameCell(r)}</td><td><div class="tag-row">${badge(r.active_days>=2?'多日使用':'单日使用','blue')}${badge(`${r.artifacts!=null?r.artifacts+' 条累计产物':'产物数量未公开'}`)}${r.feedback?.length?badge('有任务评分','green'):badge('任务目的待核')}</div><div class="cell-sub">来源：${shown(r.sources?.['8062']?.['账号来源']||r.source)}</div></td><td>${fmt(r.active_days)} 天</td><td>${fmt(r.return_tasks)} 个<div class="cell-sub">跨天新任务按用户去重汇总</div></td><td>${r.order_count?esc(r.amount_band):esc(r.payment_status)}<div class="cell-sub">${r.order_count?`${r.order_count} 笔 · 非净收入`:'不能推断历史从未付款'}</div></td><td>${day(r.behavior_last_used)}</td><td>${reviewTag(r)}</td></tr>`);
 }else if(state.view==='orders'){
  heads=['公开序号','用户','付款月份','商品','金额区间','类型','来源'];
  rows=d.rows.map(r=>`<tr><td class="mono">${esc(r.id)}</td><td>${nameCell(r)}</td><td>${esc(stamp(r.paid_at))}</td><td>${esc(r.product)}</td><td class="amount">${esc(r.amount_band)}</td><td>${badge(r.kind,r.sequence===1?'':'green')}</td><td>${esc(r.source)}<div class="cell-sub">${esc(r.channel)}</div></td></tr>`);
 }else if(state.view==='registered'){
  heads=['用户','注册月份','来源','任务 / 产物','付款连接','复盘'];
  rows=d.rows.map(r=>`<tr><td>${nameCell(r)}</td><td>${day(r.registered_at)}</td><td>${shown(r.source)}<div class="cell-sub" title="${esc(r.channel)}">${shown(r.channel)}</div></td><td>${fmt(r.tasks)} / ${fmt(r.artifacts)}<div class="cell-sub">${esc(state.meta.segments[r.segment])}</div></td><td>${badge(r.payment_status,['已付款','有月付记录'].includes(r.payment_status)?'green':'')}<div class="cell-sub">${r.paid_cents===null?'':money(r.paid_cents)}</div></td><td>${reviewTag(r)}</td></tr>`);
 }else if(state.view==='paid'){
  heads=['用户','来源','累计付款','订单数','近 7 日使用','最近付款月份','复盘'];
  rows=d.rows.map(r=>`<tr><td>${nameCell(r)}</td><td>${shown(r.source)}<div class="cell-sub" title="${esc(r.channel)}">${shown(r.channel)}</div></td><td class="amount">${esc(r.amount_band)}</td><td class="numeric">${fmt(r.order_count)}</td><td>${activityTag(r.paid_active_days)}</td><td>${day(r.last_paid)}</td><td>${reviewTag(r)}</td></tr>`);
 }else{
  heads=['用户','会员 / 套餐','使用状态','近 7 天活跃','到期日期','关注原因','复盘'];
  rows=d.rows.map(r=>`<tr><td>${nameCell(r)}</td><td>${badge(r.membership,r.membership==='有效月会员'?'green':'')}<div class="cell-sub">${shown(r.plan)}</div></td><td>${badge(r.usage,/无|未|沉默/.test(r.usage||'')?'amber':'')}</td><td>${activityTag(r.monthly_active_days)}</td><td>${day(r.expires_at)}<div class="cell-sub">${r.remaining_days===null?'':`提取时剩余 ${esc(r.remaining_days)} 天`}</div></td><td style="white-space:normal;min-width:150px;max-width:190px">${r.attention?esc(r.attention):'—'}</td><td>${reviewTag(r)}</td></tr>`);
 }
 $('#tableHead').innerHTML='<tr>'+heads.map(x=>`<th>${x}</th>`).join('')+'</tr>';
 $('#tableBody').innerHTML=rows.join('')||`<tr><td colspan="${heads.length}" class="empty"><strong>没有符合条件的记录</strong>调整关键词、日期或筛选条件后再查看。<br><button class="text-button" data-clear>清空筛选</button></td></tr>`;
 $('#resultCount').textContent=`${fmt(d.total)} 条匹配`;state.page=d.page;$('#tableBody').closest('.table-scroll').scrollTop=0;
 $('#pageInfo').textContent=d.total?`第 ${d.page} / ${Math.ceil(d.total/d.size)} 页 · ${fmt((d.page-1)*d.size+1)}–${fmt(Math.min(d.total,d.page*d.size))} / ${fmt(d.total)}`:'0 条记录';
 $('#prevPage').disabled=d.page<=1;$('#nextPage').disabled=d.page*d.size>=d.total;
 const notes={paid:`近 7 日使用来自 q8016 的完整日窗口（截至 ${state.meta.payment_end}）；金额为有效 paid 订单金额，尚未并入全产品退款。点击公开账号查看已关联的订单和任务。`,registered:'注册卡按源查询排除了指定昵称及 SQL NULL 昵称，不是严格全注册人口。累计任务与产物不是完整漏斗；没有 ID 对照的付款字段显示“未连接”。',monthly:'会员使用来自滚动 7 天窗口，与付款页完整日使用口径不同。余额、剩余天数、会员状态均为提取时值；未到期且没有续购不等于续费失败。',attention:'关注原因直接来自原运营卡，不代表已联系或已确认流失原因。点击用户查看公开档案。',orders:`当前卡默认范围为 ${state.meta.payment_start} 至 ${state.meta.payment_end}；不含今日未结束订单。排除源查询指定内部账户、非正金额与 test-1cent。`};
 $('#scopeNote').textContent=state.view==='verified'?'按已验证状态展示档案。点击公开账号查看已关联的证据。':state.view==='core'?`来源 q8062 · ${state.insights?.window.start||''} 至 ${state.insights?.window.end||''}。仅返回按跨天新任务排序的前 500 人；筛选统计只覆盖该名单。不同任务 ID 可能是返工，内部账号尚未完整排除；职业、动机、实际采用需要逐人核查。`:notes[state.view];
}
function renderCharts(d){window.publicOrderCharts(d);}
async function load(){
 const seq=++state.seq;if(state.view==='sources'){renderSources();saveURL();return;}
 if(state.view==='content'){error('');$('#insightView').setAttribute('aria-busy','true');try{const d=await api('/api/content');if(seq!==state.seq)return;renderContent(d);saveURL();}catch(e){if(seq===state.seq)error(e.message);}finally{if(seq===state.seq)$('#insightView').setAttribute('aria-busy','false');}return;}
 if(state.view==='population'){error('');$('#insightView').setAttribute('aria-busy','true');try{const d=await api('/api/population');if(seq!==state.seq)return;renderPopulation(d);saveURL();}catch(e){if(seq===state.seq)error(e.message);}finally{if(seq===state.seq)$('#insightView').setAttribute('aria-busy','false');}return;}
 if(state.view==='priority'){error('');$('#insightView').setAttribute('aria-busy','true');try{const d=await api('/api/priority');if(seq!==state.seq)return;state.priority=d;renderPriority(d);saveURL();}catch(e){if(seq===state.seq)error(e.message);}finally{if(seq===state.seq)$('#insightView').setAttribute('aria-busy','false');}return;}
 if(['overview','work','actions'].includes(state.view)){error('');$('#insightView').setAttribute('aria-busy','true');try{const d=await api('/api/insights');if(seq!==state.seq)return;state.insights=d;renderInsights(d);saveURL();}catch(e){if(seq===state.seq)error(e.message);}finally{if(seq===state.seq)$('#insightView').setAttribute('aria-busy','false');}return;}
 if($('#dateFrom').value&&$('#dateTo').value&&$('#dateFrom').value>$('#dateTo').value){error('开始日期不能晚于结束日期。');return;}
 error('');$('#dataView').setAttribute('aria-busy','true');$('#resultCount').textContent='正在查询…';
 try{const d=await api((state.view==='orders'?'/api/orders?':'/api/users?')+filters());if(seq!==state.seq)return;state.result=d;renderMetrics(d.summary);renderTable(d);if(state.view==='orders')renderCharts(d);saveURL();}
 catch(e){if(seq===state.seq){error(e.message);$('#resultCount').textContent='读取失败';}}
 finally{if(seq===state.seq)$('#dataView').setAttribute('aria-busy','false');}
}
function clearFilters(){$('#coreDays').value='0';$('#coreReturns').value='0';$('#corePaid').value='';for(const id of ['search','source','segment','tasksBucket','usage','review','product','activity','dateFrom','dateTo'])$('#'+id).value='';state.page=1;load();}
function setView(view,restore=false){
 for(const id of ["dateFrom","dateTo"])$("#"+id).type="month";
 state.view=view;state.page=1;window.scrollTo(0,0);const c=config[view];$('#title').textContent=c.title;$('#subtitle').textContent=c.subtitle;$('#tableTitle').textContent=c.table||'';
 document.querySelectorAll('nav [data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 const insight=['population','content','overview','work','actions','priority'].includes(view);$('#insightView').hidden=!insight;if(insight)$('#insightView').innerHTML='<p class="caption" role="status">正在读取真实用户与证据…</p>';$('#dataView').hidden=view==='sources'||insight;$('#sourceView').hidden=view!=='sources';$('#exportButton').hidden=view==='sources'||insight;$('#ordersCharts').hidden=view!=='orders';
 for(const id of ['coreDaysWrap','coreReturnsWrap','corePaidWrap'])$('#'+id).hidden=view!=='core';
 $('#coreDays').value='3';$('#coreReturns').value='2';$('#corePaid').value='';
 $('#dateLabel').textContent=c.date||'';$('#search').placeholder=view==='orders'?'搜索订单序号、公开账号或商品':'搜索公开账号或来源';
 $('#segmentWrap').hidden=view!=='registered';$('#tasksBucketWrap').hidden=view!=='registered';$('#usageWrap').hidden=!['monthly','attention'].includes(view);$('#productWrap').hidden=view!=='orders';$('#activityWrap').hidden=view!=='paid';$('#reviewWrap').hidden=view==='orders';$('#sortWrap').hidden=view==='orders';
 for(const id of ['search','source','segment','tasksBucket','usage','review','product','activity','dateFrom','dateTo'])$('#'+id).value='';
 $('#sort').value=c.sort||'paid_cents:desc';if(view==='orders')setRangeLatest();
 if(restore){for(const [id,k] of [['search','q'],['source','source'],['segment','segment'],['tasksBucket','tasks_bucket'],['usage','usage'],['review','review'],['product','product'],['activity','activity'],['dateFrom','from'],['dateTo','to'],['coreDays','min_days'],['coreReturns','min_returns'],['corePaid','paid']])if(initial.has(k))$('#'+id).value=initial.get(k);if(initial.has('sort'))$('#sort').value=initial.get('sort')+':'+(initial.get('direction')||'desc');state.page=Math.max(1,Number(initial.get('page'))||1);}
 window.publicListControls(view);load();
}
function renderSources(){renderEvidenceSources();}
function fact(label,value){return `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;}
async function openDetail(key){
 const dialog=$('#detailDialog');$('#detailTitle').textContent='正在读取用户…';$('#detailBody').innerHTML='<p class="caption">正在读取真实业务记录…</p>';if(!dialog.open)dialog.showModal();
 try{const d=await api('/api/user/'+encodeURIComponent(key));if(!dialog.open)return;state.detail=d;renderDetail(d);}
 catch(e){$('#detailBody').innerHTML=`<p class="inline-error">${esc(e.message)}</p>`;}
}
function renderDetail(d){
 const u=d.user,m=d.raw['8775'],b=d.raw['7996'];$('#detailTitle').textContent=u.name==='未填写昵称'?'账号 '+(u.code||u.user_id):u.name;
 const factsA=fact('公开用户编号',u.user_id?esc(u.user_id):'未连接')+fact('账号码','未公开')+fact('注册时间',shown(u.registered_at))+fact('行为卡来源',shown(u.behavior_source))+fact('付款卡来源',shown(u.payment_source))+fact('注册渠道',shown(u.channel))+fact('累计任务 / 产物',b?`${fmt(u.tasks)} / ${fmt(u.artifacts)}`:'注册行为未连接')+fact('累计消耗 / 行为卡余额','未公开');
 const factsB=m?fact('会员状态',badge(u.membership,'green'))+fact('套餐',shown(u.plan))+fact('月费卡可用积分','未公开')+fact('滚动 7 天活跃',m['近7天活跃天数']===null?'未记录':`${fmt(m['近7天活跃天数'])} 天`)+fact('本月段新增 / 成功任务','未公开')+fact('月段到期时间',shown(u.expires_at))+fact('最近成功使用',shown(m['最近一次使用时间'])):'<p class="caption">当前没有通过 ID 连接到月费会员卡；不能据此判断会员身份。</p>';
 $('#detailBody').innerHTML=`<div class="detail-meta">${badge(u.payment_status,u.payment_status==='已付款'?'green':'')}${badge('复盘：'+(u.review||'未公开'))}${badge('动机：'+(u.motivation||'未确认'))}</div><p class="caption">数据组装 ${esc(stamp(d.snapshot))} · 各来源提取时间见下方 · 已连接 ${u.linked_sources.map(x=>'q'+esc(x)).join(' / ')}。</p><div class="detail-grid"><section><h3>注册与累计行为</h3><dl class="facts">${factsA}</dl></section><section><h3>月费权益与使用</h3><p class="caption">来源提取 ${esc(stamp(d.source_dates['8775']))}</p><dl class="facts">${factsB}</dl></section></div><section class="detail-section"><div class="section-heading"><h3>付款订单</h3><span class="muted">${d.orders.length?`${d.orders.length} 笔`:''}</span></div>${d.orders.length?`<div class="detail-orders"><table><thead><tr><th>公开序号</th><th>付款时间</th><th>商品</th><th>金额</th></tr></thead><tbody>${d.orders.map(o=>`<tr><td>${esc(o.id)}</td><td>${esc(stamp(o.paid_at))}</td><td>${esc(o.product)}</td><td class="amount">${esc(o.amount_band)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="caption">${u.payment_status==='订单窗口无付款'?`当前订单窗口截至 ${esc(d.payment_end)} 未观察到付款。`:'尚无账号码对照，未连接订单流水；不代表没有付款。'}</p>`}<p class="caption">订单来源：q8004 付款明细。金额未扣全产品退款，月费退款如有记录见源记录。</p></section><section class="detail-section"><h3>复盘进度</h3><p class="caption">个人复盘信息仅在内部版本维护。</p>${u.other_reviews?.length?`<details><summary>另有 ${u.other_reviews.length} 份历史身份下的复盘记录（已保留）</summary>${u.other_reviews.map(r=>`<p class="caption">${esc(stamp(r.updated_at))} · ${esc(r.review)} · ${esc(r.motivation)}<br>${esc(r.note)}</p>`).join('')}</details>`:''}<form id="reviewForm" class="review-form"><div class="review-grid"><label>复盘状态<select name="review">${['未复盘','待核查','已核查'].map(x=>`<option ${x===u.review?'selected':''}>${x}</option>`).join('')}</select></label><label>历史动机标记<select name="motivation">${[...new Set(['未确认','其他已确认',u.motivation||'未确认'])].map(x=>`<option ${x===(u.motivation||'未确认')?'selected':''}>${x}</option>`).join('')}</select></label></div><label>证据链接<input name="evidence" type="url" maxlength="1000" placeholder="原任务、访谈或交付记录链接" value="${esc(u.evidence||'')}"></label><label>复盘笔记<textarea name="note" maxlength="5000" placeholder="记录观察到的事实、用户原话、待验证的问题…">${esc(u.note||'')}</textarea></label><div class="save-row"><button class="primary" type="submit">保存复盘记录</button><span id="saveStatus" class="caption" role="status">${u.updated_at?'上次保存 '+esc(stamp(u.updated_at)):''}</span></div></form></section><section class="detail-section"><h3>公开记录与证据来源</h3>${Object.entries(d.raw).map(([id,r])=>`<details><summary>q${esc(id)} · ${esc(state.meta.manifest.sources[id]?.name||'业务卡')} · ${Object.keys(r).length} 个字段 · ${esc(stamp(d.source_dates[id]))}</summary><p class="caption">该卡片的公开字段</p><table class="source-raw">${Object.entries(r).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${v===null?'未记录':esc(typeof v==='object'?JSON.stringify(v,null,2):v)}</td></tr>`).join('')}</table></details>`).join('')}</section>`;
 mountFinding(d);
 mountPriorityProfile(d);
 mountContentProfile(d);

 $('#detailBody').querySelectorAll('form input,form select,form textarea,form button').forEach(el=>{el.disabled=true;el.title='公开版只读';});

}

function checkSync(){}
function sync(){setView('sources');}

let searchTimer;
document.addEventListener('click',e=>{const v=e.target.closest('[data-view]'),u=e.target.closest('[data-user]'),d=e.target.closest('[data-day]'),p=e.target.closest('[data-product]');if(v){if(v.dataset.priorityGroup)state.priorityGroup=v.dataset.priorityGroup;setView(v.dataset.view);return;}if(u){openDetail(u.dataset.user);return;}if(d){$('#dateFrom').value=d.dataset.day;$('#dateTo').value=d.dataset.day;state.page=1;load();return;}if(p){$('#product').value=p.dataset.product;state.page=1;load();return;}if(e.target.closest('[data-clear]'))clearFilters();});
$('#filters').addEventListener('submit',e=>{e.preventDefault();state.page=1;load();});
$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.page=1;load();},180);});
for(const id of ['source','segment','tasksBucket','usage','review','product','activity','dateFrom','dateTo','sort','coreDays','coreReturns','corePaid'])$('#'+id).addEventListener('change',()=>{state.page=1;load();});
$('#pageSize').addEventListener('change',()=>{state.size=Number($('#pageSize').value);state.page=1;load();});
$('#prevPage').onclick=()=>{state.page--;load();};$('#nextPage').onclick=()=>{state.page++;load();};$('#clearFilters').onclick=clearFilters;
$('#resetRange').onclick=()=>{setRangeLatest();state.page=1;load();};$('#closeDetail').onclick=()=>$('#detailDialog').close();$('#syncButton').onclick=sync;
$('#exportButton').onclick=()=>window.exportPublicList().catch(e=>error(e.message));
async function init(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const options={signal:controller.signal};
  [state.meta,state.insights]=await Promise.all([api('/api/meta',options),api('/api/insights',options)]);
  renderMeta();setView(state.view,true);
  $('.layout').hidden=false;$('#entryStatus').hidden=true;checkSync();if(initial.get('view')==='profile' && /^P-[a-f0-9]{12}$/.test(initial.get('user')||'')){openDetail(initial.get('user'));}
 }catch(e){
  $('#entryMessage').textContent=e.name==='AbortError'?'公开快照响应超时，请重新打开看板。':'公开快照未能载入，请重新打开看板。';
 }finally{clearTimeout(timer);}
}
init();
