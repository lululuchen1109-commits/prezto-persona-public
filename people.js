/* Browse the public business snapshot. All links refer to anonymous records in this site. */
(() => {
  'use strict';
  const titles = {
    registered:'全部注册用户', paid:'付款用户', monthly:'月费会员', attention:'重点关注',
    priority:'重点用户', core:'核心用户候选', verified:'已验证档案', orders:'订单流水', profile:'用户档案'
  };
  const descriptions = {
    registered:'按注册来源和累计行为筛选，再打开档案查看这个人的使用记录。',
    paid:'按订单笔数和付款后的使用情况查看账号。',
    monthly:'查看月费记录中的会员状态与使用情况。',
    attention:'查看月费运营来源标记为需要关注的账号。',
    priority:'选择一个研究问题，查看符合条件的人和对应证据。同一人可能符合多项条件。',
    core:'按近 28 天成功使用天数、跨天再建任务数筛选。覆盖范围仅限来源提供的行为名单。',
    verified:'仅收录已核实具体工作、采用和复用证据的档案。',
    orders:'按付款月份、商品和付款类型查看订单，金额以区间显示。'
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => Number.isFinite(value) ? Number(value).toLocaleString('zh-CN') : '未提供';
  const show = value => value == null || value === '' ? '未提供' : escape(value);
  const url = (view, params = {}) => '?' + new URLSearchParams({view,...params}).toString();
  const link = (view, params, label) => '<a href="'+escape(url(view,params))+'">'+escape(label)+'</a>';
  const profileLink = id => link('profile',{user:id},id);
  const labelTags = tags => tags.map(t=>'<span class="pp-tag">'+escape(t)+'</span>').join(' ');
  const summary = (label,value) => '<div><dt>'+escape(label)+'</dt><dd>'+show(value)+'</dd></div>';
  const empty = msg => '<p class="pp-empty">'+escape(msg)+'</p>';
  const css = `
    .pp-view{min-width:0}.pp-view h1{overflow-wrap:anywhere}.pp-view h2{font-size:21px;margin:24px 0 10px}
    .pp-view a{text-underline-offset:.2em}.pp-view p{max-width:82ch}.pp-blurb,.pp-when{color:#5b5a55}
    .pp-blurb{margin:4px 0}.pp-when{font-size:13px}.pp-bar{display:flex;align-items:end;gap:8px 12px;flex-wrap:wrap;margin:16px 0}
    .pp-bar label{display:grid;gap:3px;font-size:13px;color:#51514d}.pp-bar input,.pp-bar select,.pp-view button{font:inherit;border:1px solid #d5d4d0;background:#fff;color:#222;border-radius:8px;padding:7px 10px}
    .pp-view button:disabled{opacity:.45}.pp-view button:not(:disabled){cursor:pointer}.pp-view button:hover:not(:disabled),.pp-view a:hover{color:#355b47}
    .pp-scroll{overflow:auto;max-width:100%}.pp-scroll table{width:100%;border-collapse:collapse;font-size:14px;white-space:nowrap}
    .pp-scroll :is(td,th){padding:9px 12px;border-bottom:1px solid #e9e7e3;text-align:left}.pp-scroll th{font-weight:550;color:#5b5a55}
    .pp-scroll td:first-child,.pp-summary dd{font-variant-numeric:tabular-nums}.pp-pager{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}
    .pp-pager span,.pp-pager button{font-size:13px}.pp-group{margin:15px 0;padding:12px 16px;border-left:3px solid #7d9388;background:#f2f4f1}
    .pp-group p,.pp-group h3{margin:2px 0}.pp-group h3{font-size:15px}.pp-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}
    .pp-summary>div{border:1px solid #dfddd8;border-radius:10px;padding:12px 14px;display:block}.pp-summary dt{font-size:13px;color:#555}.pp-summary dd{margin:4px 0;font-size:17px;font-weight:620;white-space:normal}
    .pp-tag{display:inline-block;border-radius:5px;background:#eef1ed;padding:2px 8px;margin:2px 4px 2px 0;font-size:13px}
    .pp-empty{padding:18px;background:#f4f3ef;border-radius:8px}.pp-evidence{padding-left:20px}.pp-evidence li{margin:6px 0}
  `;

  function installStyle() {
    if(document.getElementById('public-people-style')) return;
    const style=document.createElement('style'); style.id='public-people-style'; style.textContent=css; document.head.append(style);
  }
  function table(headers, rows) {
    return '<div class="pp-scroll" tabindex="0"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')+
      '</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function profile(root, data, work, id) {
    const person=data.people.find(p=>p.id===id);
    const tasks=(work?.tasks||[]).filter(t=>t.user===id);
    if(!person&&!tasks.length){root.innerHTML='<h1>用户档案</h1>'+empty('没有找到这个匿名编号。')+link('registered',{},'返回注册用户名单');return;}
    const p=person||{}, groups=data.groups.filter(g=>p.groups?.includes(g.id)), orders=data.orders.filter(o=>o.user===id);
    const fields=[
      ['注册月份',p.registered_month],['注册来源',p.source],['累计创建任务',p.tasks],['累计产物记录',p.artifacts],
      ['28 天成功使用天数',p.active_days],['28 天跨天新任务',p.return_tasks],['付款状态',p.payment_status],
      ['已关联订单笔数',p.order_count],['付款后近 7 天使用天数',p.paid_active_days],
      ['会员状态',p.membership],['会员使用',p.usage]
    ].filter(row=>row[1]!==null&&row[1]!==undefined);
    let out='<h1>用户档案</h1><p><strong>'+escape(id)+'</strong></p><p>'+labelTags((p.views||[]).map(v=>titles[v]).filter(Boolean))+'</p>';
    out+=fields.length?'<dl class="pp-summary">'+fields.map(([l,v])=>summary(l,v)).join('')+'</dl>':'<p>这个匿名账号目前只在内容报告中有记录。</p>';
    if(groups.length)out+='<h2>为什么值得关注</h2>'+groups.map(g=>'<div class="pp-group"><h3>'+link('priority',{group:g.id},g.title)+'</h3><p>'+show(g.rule)+'</p><p>建议 · '+show(g.action)+'</p></div>').join('');
    out+='<h2>真实任务 · '+fmt(tasks.length)+' 个</h2><p class="pp-when">内容报告 '+show(work?.date)+' · 只列本批能明确关联的任务。</p>';
    if(tasks.length){const detail = tasks.slice(0,8).map(t=>[
      link('content',{task:t.id},t.id),show(t.month),escape((t.purpose||[]).map(key=>work.purposes?.[key]||'未识别用途').join('、')||'未识别用途'),
      escape((t.topics||[]).join('、')||'未识别主题')
    ]);out+=table(['匿名任务','创建月份','用途线索','主题'],detail)+ '<p>'+link('content',{user:id},'查看这个账号的全部 '+fmt(tasks.length)+' 个任务 →')+'</p>';}
    else out+=empty('本批内容报告中未见可明确关联的任务。');
    out+='<h2>关联订单 · '+fmt(orders.length)+' 笔</h2>';
    if(orders.length) out+=table(['付款月份','商品','付款类型','金额区间'],orders.map(o=>[o.month,o.product,o.kind,o.amount_band].map(show)));
    else out+=empty('当前订单窗口没有可关联的订单。');
    out+='<p class="pp-when">业务快照 '+show(data.as_of)+' · 会员来源 '+show(data.dates.monthly)+'</p>';
    root.innerHTML=out;
  }

  const fields = {
    registered:[['registered_month','注册月份'],['source','注册来源'],['segment','累计行为'],['tasks','累计任务']],
    paid:[['order_count','订单笔数'],['paid_active_days','付款后近 7 天使用'],['paid_source','来源']],
    core:[['active_days','28 天使用天数'],['return_tasks','28 天跨天新任务'],['payment_status','付款关联']],
    priority:[['groups','重点标签'],['order_count','关联订单'],['active_days','28 天使用天数']],
    monthly:[['membership','会员状态'],['usage','使用状态'],['monthly_active_days','会员来源活跃天数']],
    attention:[['membership','会员状态'],['usage','使用状态'],['order_count','关联订单']],
    verified:[['segment','累计行为'],['order_count','关联订单'],['active_days','28 天使用天数']],
    orders:[['month','付款月份'],['product','商品'],['kind','付款类型'],['amount_band','金额区间']]
  };

  function csvDownload(headers, rows, view) {
    const cell=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^([=+\-@\t\r])/,"'$1")+'"';
    const body=[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
    const file=new Blob(['\uFEFF',body],{type:'text/csv;charset=utf-8'});
    const objectURL=URL.createObjectURL(file);
    const a=document.createElement('a'); a.href=objectURL; a.download='Prezto-'+view+'.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
  }

  window.renderPublicPeople = function (root, view, data, params, work) {
    installStyle();
    const pane=document.createElement('section');pane.className='pp-view';root.replaceChildren(pane);
    if(view==='profile'){profile(pane,data,work,params.get('user')||'');return;}
    if(!fields[view]){pane.textContent='没有此名单。';return;}
    const orderMode=view==='orders',unit=orderMode?'笔':'人';
    const groupMap=new Map(data.groups.map(g=>[g.id,g]));
    const rowID=r=>orderMode?r.user:r.id;
    const visibleValue=(r,k)=>k==='groups'?(r.groups||[]).map(key=>groupMap.get(key)?.title).filter(Boolean).join(' · '):r[k];
    const cohort=view==='core'?data.people.filter(p=>Number.isFinite(p.active_days)&&Number.isFinite(p.return_tasks)):
      orderMode?data.orders:data.people.filter(p=>p.views.includes(view));
    const formState=new URLSearchParams(params);
    const get=(k,d='')=>formState.get(k)??d;
    const selectedGroup=()=>groupMap.get(get('group'));
    let page=Math.max(1,Math.floor(Number(get('page')))||1), size=25, results=[];
    const when=view==='core'?data.dates.behavior:(data.dates[view]||data.as_of);
    pane.innerHTML='<h1>'+titles[view]+'</h1><p class="pp-blurb">'+descriptions[view]+'</p><p class="pp-when">来源快照 '+show(when)+'</p><form class="pp-bar"></form><div data-pp-group></div><div data-pp-list></div>';
    const form=pane.querySelector('form');
    function select(key,title,options,initial=''){
      const l=document.createElement('label');l.append(title);
      const s=document.createElement('select');s.name=key;
      for(const [value,label] of options)s.append(new Option(label,value));
      s.value=get(key,initial);if(s.selectedIndex<0)s.selectedIndex=0;
      l.append(s);form.append(l);
    }
    function values(key,label){
      const vals=[...new Set(cohort.map(p=>p[key]).filter(v=>v!=null&&v!==''))].sort();
      if(vals.length)select(key,label,[['','全部'],...vals.map(v=>[v,v])]);
    }
    const search=document.createElement('label');search.append('匿名编号');const input=document.createElement('input');
    input.type='search';input.name='q';input.placeholder='搜索匿名编号';input.value=get('q',get('user'));search.append(input);form.append(search);
    if(view==='priority')select('group','关注原因',[['','全部重点用户'],...data.groups.map(g=>[g.id,g.title+'（'+fmt(g.count)+'）'])]);
    if(view==='core'){
      select('min_days','28 天成功使用',[0,1,2,3,5,7,14].map(v=>[String(v),'至少 '+v+' 天']),'3');
      select('min_returns','跨天新任务',[0,1,2,3,5,10].map(v=>[String(v),'至少 '+v+' 个']),'2');
    }
    if(view==='registered'){values('source','注册来源');values('segment','累计行为');}
    if(['core','priority'].includes(view))values('payment_status','付款关联');
    if(view==='paid')values('paid_source','付款来源');
    if(view==='monthly'||view==='attention'){values('membership','会员状态');values('usage','使用状态');}
    if(orderMode){values('month','付款月份');values('product','商品');values('kind','付款类型');}
    if(!orderMode)select('sort','排序',[['','默认顺序'],['tasks','累计任务优先'],['order_count','多次付款优先'],['active_days','多日活跃优先']]);
    const button=(label,what)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.action=what;return b;};
    form.append(button('重置','reset'),button('导出筛选 CSV','csv'));
    function readForm() {
      const parsed=new FormData(form);
      for(const [k,v] of parsed){if(v!=='' && !(view==='core'&&(k==='min_days'&&v==='3'||k==='min_returns'&&v==='2')))formState.set(k,String(v));else formState.delete(k);}
      formState.delete('user');
    }
    function saveURL(){
      formState.set('view',view);if(page>1)formState.set('page',String(page));else formState.delete('page');
      history.replaceState(history.state,'','?'+formState.toString());
    }
    function setList(){
      const spec=fields[view], total=results.length, pages=Math.max(1,Math.ceil(total/size));page=Math.min(page,pages);
      const selected = selectedGroup();
      pane.querySelector('[data-pp-group]').innerHTML=view==='priority'&&selected?
        '<div class="pp-group"><h3>'+escape(selected.title)+'</h3><p>'+show(selected.rule)+'</p><p>建议 · '+show(selected.action)+'</p></div>':'';
      const start=(page-1)*size, slice=results.slice(start,start+size);
      let html='<h2>当前名单 · '+fmt(total)+' '+unit+'</h2>';
      if(total)html+=table(['匿名账号',...spec.map(x=>x[1])],slice.map(r=>[profileLink(rowID(r)),...spec.map(([k])=>show(visibleValue(r,k)))]));
      else html+=empty(view==='verified'&&!cohort.length?'当前快照中尚无已完成核实的档案。':'没有符合这些筛选条件的记录。');
      html+='<div class="pp-pager"><span>'+fmt(total?start+1:0)+'–'+fmt(Math.min(total,start+size))+' / '+fmt(total)+' '+unit+'</span><div><button type="button" data-action="prev" '+(page<=1?'disabled':'')+'>上一页</button> <button type="button" data-action="next" '+(page>=pages?'disabled':'')+'>下一页</button></div></div>';
      pane.querySelector('[data-pp-list]').innerHTML=html;
    }
    function filter(){
      const entries=[...new FormData(form)], query=input.value.trim().toLowerCase();
      results=cohort.filter(r=>{
        if(query&&!rowID(r).toLowerCase().includes(query))return false;
        return entries.every(([k,v])=>{
          if(!v||k==='q'||k==='sort')return true;
          if(k==='group')return r.groups.includes(v);
          if(k==='min_days')return r.active_days>=Number(v);
          if(k==='min_returns')return r.return_tasks>=Number(v);
          return r[k]===v;
        });
      });
      const sorting=form.elements.sort?.value||
        ({priority:'order_count',paid:'order_count',core:'return_tasks',registered:'registered_month'}[view]);
      if(sorting)results.sort((a,b)=>typeof a[sorting]==='string'||typeof b[sorting]==='string'?
        String(b[sorting]??'').localeCompare(String(a[sorting]??'')):(b[sorting]??-1)-(a[sorting]??-1));
      setList();
    }
    function change(){readForm();page=1;filter();saveURL();}
    form.addEventListener('submit',e=>{e.preventDefault();change();});
    input.addEventListener('input',change);
    form.addEventListener('change',e=>{if(e.target!==input)change();});
    pane.addEventListener('click',e=>{
      const action=e.target.closest('button[data-action]')?.dataset.action;
      if(action==='csv'){const spec=fields[view];csvDownload(['匿名账号',...spec.map(x=>x[1])],results.map(r=>[rowID(r),...spec.map(([k])=>visibleValue(r,k))]),view);return;}
      if(action==='reset'){location.href=url(view);return;}
      if(action==='next'||action==='prev'){page+=action==='next'?1:-1;setList();saveURL();pane.querySelector('[data-pp-list]').scrollIntoView({block:'start'});}
    });
    filter();
  };
})();
