(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = value => Number(value || 0).toLocaleString('zh-CN');
  const url = (view, values = {}) => '?' + new URLSearchParams({view, ...values});
  const link = (text, view, values) => '<a href="'+escape(url(view, values))+'">'+escape(text)+'</a>';
  const accounts = rows => new Set(rows.map(row => row.user)).size;
  const rowsTable = (columns, rows) => '<div style="overflow-x:auto"><table><thead><tr>'+columns.map(label=>'<th scope="col">'+escape(label)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((cell,i)=>i ? '<td>'+cell+'</td>':'<th scope="row">'+cell+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';
  function metrics(entries) {
    return '<div class="metrics">'+entries.map(([name,count])=>'<div class="metric"><span>'+escape(name)+'</span><b>'+n(count)+'</b></div>').join('')+'</div>';
  }
  const actionLabels = {xhs:'摘要提到小红书',green:'摘要提到小绿书',handoff:'已唤起小红书',draft:'公众号草稿已同步'};
  function contentPage(root,d,params) {
    const filters = new URLSearchParams(params);
    const taskCounts = new Map();
    for (const task of d.tasks) taskCounts.set(task.user, (taskCounts.get(task.user)||0)+1);
    const groups = Object.fromEntries(Object.entries(d.members).map(([key,ids])=>[key,new Set(ids)]));
    function select(key,title,options) {
      const make = (value,label) => '<option value="'+escape(value)+'" '+(filters.get(key)===value?'selected':'')+'>'+escape(label)+'</option>';
      return '<label>'+escape(title)+' <select name="'+key+'">'+make('','全部')+Object.entries(options).map(([id,label])=>make(id,label)).join('')+'</select></label>';
    }
    root.innerHTML='<h1>真实用途与任务</h1><p>内容报告生成于 '+escape(d.date)+'，覆盖 '+n(d.users)+' 个账号和 '+n(d.tasks.length)+' 个任务。每条记录可查看任务分类和同一用户的其他工作。</p>'+
      '<form class="public-work-filters" style="display:flex;align-items:end;gap:10px;flex-wrap:wrap"><label>关键词 <input type="search" name="q" value="'+escape(filters.get('q')||'')+'" placeholder="主题、用途或匿名编号"></label>'+
      select('purpose','用途',d.purposes)+select('payment','付款',{paid:'有付款记录',no_payment:'本批无付款',unlinked:'未关联'})+
      select('repeat','任务数',{multiple:'至少两个',single:'一个'})+select('account','账号范围',{excludeTest:'排除测试账号',sourceTest:'测试账号'})+
      select('cohort','研究人群',d.cohorts)+select('action','任务信号',actionLabels)+'<button type="submit">查询</button> '+link('清除筛选','content')+'</form><div data-work-results></div>';
    const form = root.querySelector('form'), result = root.querySelector('[data-work-results]');
    function refresh(updateURL) {
      const values = Object.fromEntries(filters);
      const term = (values.q||'').trim().toLowerCase();
      const rows = d.tasks.filter(t => {
        if(values.task && t.id!==values.task || values.user && t.user!==values.user) return false;
        if(values.purpose && !t.purpose.includes(values.purpose)) return false;
        if(values.cohort && !groups[values.cohort]?.has(t.user)) return false;
        if(values.account==='excludeTest' && t.test || values.account==='sourceTest' && !t.test) return false;
        if(values.payment && values.payment !== (t.paid?'paid':t.paymentKnown?'no_payment':'unlinked')) return false;
        if(values.repeat==='multiple' && taskCounts.get(t.user)<2 || values.repeat==='single' && taskCounts.get(t.user)!==1) return false;
        if(values.action && (!Object.hasOwn(actionLabels,values.action) || !t[values.action])) return false;
        return !term || [t.id,t.user,...t.topics,...t.purpose.map(k=>d.purposes[k]),...Object.keys(actionLabels).filter(k=>t[k]).map(k=>actionLabels[k])].join(' ').toLowerCase().includes(term);
      });
      const pageSize=20, pages=Math.max(1, Math.ceil(rows.length/pageSize));
      const page=Math.min(pages,Math.max(1,parseInt(filters.get('page'),10)||1));
      if (page>1) filters.set('page',String(page)); else filters.delete('page');
      if (updateURL) history.replaceState(null,'','?'+filters.toString());
      let html='<p role="status"><strong>'+n(rows.length)+' 个任务 · '+n(accounts(rows))+' 个账号</strong>';
      if (values.user) html+=' · '+link('打开用户档案 '+values.user,'profile',{user:values.user});
      if (values.task) html+=' · '+escape(values.task);
      html+='</p>';
      if (values.task && rows.length===1) {
        const task=rows[0];
        const patterns=task.topics.length ? task.topics.join('、') : '摘要中没有匹配到具体工作主题';
        const evidence=Object.entries(actionLabels).filter(([key])=>task[key]).map(([,label])=>label);
        html+='<article><h2 style="margin-top:0">'+escape(patterns)+'</h2><p>'+escape(task.month)+' 创建 · '+escape(task.purpose.map(k=>d.purposes[k]).join('、'))+'</p>'+
          '<p>任务信号：'+escape(evidence.join('、')||'当前没有观察到格式提及或后续动作')+'。</p>'+
          '<p>'+link('查看这个账号的全部 '+n(taskCounts.get(task.user))+' 个任务','content',{user:task.user})+'　'+link('查看用户档案','profile',{user:task.user})+'</p></article>';
      }
      if (rows.length) {
        html+=rowsTable(['工作主题','任务与月份','用途线索','后续动作','用户档案'],rows.slice((page-1)*pageSize,page*pageSize).map(t=>{
          const topic=t.topics.length?t.topics.join('、'):'暂无明确主题';
          const kinds=t.purpose.map(k=>d.purposes[k]).join('、');
          const actions=[t.handoff?'已唤起小红书':'',t.draft?'已同步草稿':''].filter(Boolean);
          return [escape(topic),link(t.id,'content',{task:t.id})+'<br><small>'+escape(t.month)+'</small>',escape(kinds),escape(actions.join('、')||'未记录'),link(t.user,'profile',{user:t.user})+'<br>'+link('同人任务 '+n(taskCounts.get(t.user)),'content',{user:t.user})];
        }));
        if(pages>1) html+='<div style="display:flex;gap:12px;align-items:center;margin:16px 0"><button data-turn="-1" '+(page===1?'disabled':'')+'>上一页</button><span>'+page+' / '+pages+'</span><button data-turn="1" '+(page===pages?'disabled':'')+'>下一页</button></div>';
      } else html+='<p>没有符合这些条件的任务。</p>';
      html+='<p>工作主题和用途由摘要中的词语匹配，可同时出现多个。'+n(d.truncated)+' 个任务的来源摘要经过截断。</p>';
      result.innerHTML=html;
      for(const button of result.querySelectorAll('button[data-turn]')) button.onclick=()=>{filters.set('page',String(page+Number(button.dataset.turn)));refresh(true);result.scrollIntoView({block:'start'});};
    }
    function apply(event) {
      event.preventDefault();
      for(const [key,val] of new FormData(form)) {
        if(val) filters.set(key,val); else filters.delete(key);
      }
      filters.set('view','content');filters.delete('page');refresh(true);
    }
    form.onsubmit=apply; form.onchange=event=>{if(event.target.tagName==='SELECT')apply(event);};
    refresh(false);
  }
  function research(d) {
    const tasks=d.tasks, field=tasks.filter(t=>!t.test), repeatedPaid=field.filter(t=>t.paid&&d.members.repeatDays.includes(t.user));
    const sections=Object.entries(d.purposes).filter(([k])=>k!=='unknown').map(([k,label])=>{
      const rows=tasks.filter(t=>t.purpose.includes(k));
      return [link(label,'content',{purpose:k}),String(accounts(rows)),String(rows.length)];
    }).sort((a,b)=>Number(b[1])-Number(a[1]));
    return '<h1>研究与重点线索</h1><p>内容报告生成于 '+escape(d.date)+'。可从用途分布和回访行为进入真实账号，比较同一用户在不同任务中需要完成的工作。</p>'+
      metrics([['内容报告账号',d.users],['含用途线索的任务',tasks.filter(t=>t.purpose.some(k=>k!=='unknown')).length],['付费且跨日建任务（排除测试）',accounts(repeatedPaid)]])+
      '<div class="grid"><article><h3>用户反复来做什么</h3><p>'+n(accounts(repeatedPaid))+' 人既有付款记录，也在至少两个不同日期新建了任务。核对每个人前后几次的主题，可以找到重复出现的工作场景。</p>'+link('比较这批用户的任务','content',{account:'excludeTest',payment:'paid',cohort:'repeatDays'})+'</article>'+
      '<article><h3>谁尝试了不同格式</h3><p>有 '+n(d.members.mentionsBoth.length)+' 个账号在摘要中提过小红书和小绿书。先看两种格式出现在哪些任务，再核对后续动作。</p>'+link('查看同人跨格式记录','content',{cohort:'mentionsBoth'})+'</article></div>'+
      '<h2>用户带来了哪些工作</h2><p>一人或一个任务可以匹配多项。点击用途即可查看对应任务。</p>'+rowsTable(['用途','涉及账号','任务'],sections)+
      '<p>'+link('查看用途未识别的任务','content',{purpose:'unknown'})+'</p>';
  }
  function outputPage(d) {
    const counts=(key)=>d.tasks.filter(t=>t[key]);
    const signals=Object.entries(actionLabels).map(([key,label])=>[link(label,'content',{action:key}),n(accounts(counts(key))),n(counts(key).length)]);
    const groups=Object.entries(d.cohorts).filter(([key])=>['mentionsBoth','mentionsForward','mentionsReverse','bothActions'].includes(key)).map(([key,label])=>[link(label,'content',{cohort:key}),n(d.members[key].length)]);
    return '<h1>工作场景与证据</h1><p>先看任务的实际产物类型，再对照用户在摘要中提过的格式及工作完成后留下的动作。</p>'+
      '<h2>实际产物</h2><p>'+escape(d.jobWindow.join(' 至 '))+'，按每个任务首次产出的主类型统计。小红书和小绿书在产物来源中合并统计。</p>'+
      rowsTable(['产物类型','产出账号','任务','回来做新任务的账号'],d.jobs.map(r=>[escape(r.name),n(r.users),n(r.tasks),n(r.returns)]))+
      '<details><summary>查看多种产物的用户组合</summary><p>'+escape(d.comboDate)+' 提取，来源统计观察窗口内活跃账号截至窗口末的历史产物组合，各组合人数可重叠。</p>'+
      rowsTable(['产物组合','账号','回来做新任务的账号'],d.combinations.map(r=>[escape(r.names.join(' ＋ ')),n(r.users),n(r.returns)]))+'</details>'+
      '<h2>小红书与小绿书</h2><p>内容批次生成于 '+escape(d.date)+'。跨任务顺序按任务创建时间判断。当前观察到的交接和草稿同步只记录到对应阶段，成功发布仍待核实。</p>'+
      '<div class="grid"><article><h3>任务摘要与动作</h3>'+rowsTable(['信号','涉及账号','任务'],signals)+'</article><article><h3>同一用户的跨格式证据</h3>'+rowsTable(['用户分组','涉及账号'],groups)+'</article></div>';
  }
  window.renderPublicWork = (root,view,data,params) => {
    if(view==='content') return contentPage(root,data,new URLSearchParams(params));
    root.innerHTML=view==='work'?outputPage(data):research(data);
  };
})();
