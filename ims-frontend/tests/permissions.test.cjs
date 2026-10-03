/* eslint-disable @typescript-eslint/no-require-imports -- Node loader for application TypeScript. */
const {test, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
};
const {useAuthStore} = require('../src/store/authStore.ts');
const originalLoad=Module._load;
let pathname='/admin/users';
// Snapshot rendering uses the actual store; this is not a browser interaction test.
Module._load=function(request,parent,isMain){
 if(request==='@/store/authStore') return {useAuthStore:Object.assign(selector=>selector?selector(useAuthStore.getState()):useAuthStore.getState(),useAuthStore)};
 if(request==='next/navigation') return {usePathname:()=>pathname,useRouter:()=>({replace:()=>{throw new Error('Authenticated denial must not redirect');}}),redirect:href=>{throw {redirect:href};}};
 if(request==='@/components/admin/inventory/InventoryWorkspace') return {__esModule:true,default:function InventoryWorkspace(){return null;}};
 if(request==='next/link') return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
 if(request.startsWith('@/')) request=path.resolve(__dirname,'../src',request.slice(2));
 return originalLoad.call(this,request,parent,isMain);
};
const nav=require('../src/components/layout/shell-navigation.ts');
const {routes, routeIds, routeHref, resolveRouteId, canAccessRoute}=require('../src/lib/routing/routes.ts');
const {routeAliases}=require('../src/lib/routing/route-aliases.ts');
const {routePolicies}=require('../src/lib/routing/route-policy.ts');
const {default:PermissionGuard,PermissionAction}=require('../src/components/auth/PermissionGuard.tsx');
const PermissionRoute=require('../src/components/auth/PermissionRoute.tsx').default;
const {loadIfAllowed}=require('../src/lib/permission-loading.ts');
const catalog=[...fs.readFileSync(path.resolve(__dirname,'../../ims-backend/src/auth/rbac/permission-catalog.ts'),'utf8').matchAll(/key: '([^']+)'/g)].map(match=>match[1]);
function signIn(permissions,role='STAFF') {useAuthStore.getState().setAuthenticated({id:'test',name:'Test',email:'test@example.invalid',role,effectivePermissions:permissions,roles:[],authorizationRevision:'revision'});}
function featureHrefs(){return nav.getVisibleNavigation(useAuthStore.getState()).flatMap(group=>group.items).filter(item=>item.routeId!=='settings').map(item=>item.href);}
beforeEach(()=>useAuthStore.getState().logout());

test('Administrator sees all menus with backend catalog grants',()=>{
 signIn(catalog,'ADMINISTRATOR');
 assert.deepEqual(featureHrefs(),nav.adminNavigation.flatMap(group=>group.items).filter(item=>item.routeId!=='settings').map(item=>item.href));
 assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),'/admin/dashboard');
});
test('inventory-only account sees inventory and authenticated self settings',()=>{
 signIn(['inventory.view']);assert.deepEqual(featureHrefs(),['/admin/inventory']);
 assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),'/admin/inventory');
 assert.equal(nav.getRouteAccess('/admin/inventory',useAuthStore.getState()),true);
 assert.equal(nav.getRouteAccess('/admin/inventory/suppliers',useAuthStore.getState()),false);
 assert.equal(nav.getRouteAccess('/admin/inventory/materials/add',useAuthStore.getState()),false);
});
test('cashier sees POS without unrelated modules or history',()=>{
 signIn(['pos.view','pos.checkout']);assert.deepEqual(featureHrefs(),['/staff/pos']);
 assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),'/staff/pos');
 assert.equal(nav.getRouteAccess('/staff/dashboard',useAuthStore.getState()),true);
 assert.equal(nav.getRouteAccess('/staff/transactions',useAuthStore.getState()),false);
});
test('legacy role does not implicitly grant catalog permissions',()=>{
 signIn(['inventory.view'],'ADMINISTRATOR');
 assert.equal(useAuthStore.getState().can('products.delete'),false);
 assert.equal(nav.getRouteAccess('/admin/products',useAuthStore.getState()),false);
});
test('role management remains Administrator-only and settings stays self-service',()=>{
 signIn(catalog);assert.equal(nav.getRouteAccess('/admin/roles',useAuthStore.getState()),false);
 signIn([],'ADMINISTRATOR');assert.equal(nav.getRouteAccess('/admin/roles',useAuthStore.getState()),true);
 signIn([]);for(const route of ['/admin/settings','/staff/settings','/manager/settings'])assert.equal(nav.getRouteAccess(route,useAuthStore.getState()),true);
});
test('no grants lands on no-access',()=>{
 signIn([]);assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),'/no-access');assert.deepEqual(featureHrefs(),[]);
});
test('missing permission hides action and does not render its child',()=>{
 signIn(['products.view']);let renders=0;
 function Action(){renders++;return React.createElement('button',null,'Delete');}
 const component=React.createElement(PermissionAction,{permission:'products.delete'},React.createElement(Action));
 assert.equal(renderToStaticMarkup(component), '');assert.equal(renders,0);
 signIn(['products.delete']);assert.match(renderToStaticMarkup(component),/Delete/);
});
test('all-of guard requires every grant and revocation hides actions',()=>{
 signIn(['inventory.view','inventory.waste']);
 const component=React.createElement(PermissionGuard,{permissions:['inventory.view','inventory.waste'],fallback:null},'Waste');
 assert.equal(renderToStaticMarkup(component),'Waste');
 signIn(['inventory.view']);assert.equal(renderToStaticMarkup(component),'');
});
test('denied route shows No Access and never mounts the page data loader',()=>{
 signIn(['inventory.view']);pathname='/admin/users';let mounted=0;
 function Users(){mounted++;return React.createElement('p',null,'Sensitive users');}
 const html=renderToStaticMarkup(React.createElement(PermissionRoute,null,React.createElement(Users)));
 assert.match(html,/No Access/);assert.doesNotMatch(html,/Sensitive users/);assert.equal(mounted,0);
});
test('denied requests never start, including after logout',async()=>{
 signIn(['inventory.view']);let calls=0;const fetchData=async()=>{calls++;return ['data'];};
 for(const key of ['reports.view','stockRuns.view','suppliers.view']) assert.deepEqual(await loadIfAllowed(key,fetchData,[]),[]);
 assert.equal(calls,0);assert.deepEqual(await loadIfAllowed('inventory.view',fetchData,[]),['data']);assert.equal(calls,1);
 useAuthStore.getState().logout();await loadIfAllowed('inventory.view',fetchData,[]);assert.equal(calls,1);
});
test('navigation references registered policies using backend catalog keys and unknown routes deny',()=>{
 const items=nav.adminNavigation.flatMap(group=>group.items).flatMap(item=>[item,...(item.children??[])]);
 for(const item of [...items,...nav.materialActions]) {
  assert.ok(routes[item.routeId]);
  assert.equal(item.href, routeHref(item.routeId));
  for(const field of ['permission','permissions','authenticatedOnly','administratorOnly','policy']) assert.equal(field in item,false);
 }
 for(const policy of Object.values(routePolicies)) if(policy.type==='permission') {
  assert.ok(policy.permissions.length);
  for(const key of policy.permissions) assert.ok(catalog.includes(key),key);
 }
 signIn(catalog,'ADMINISTRATOR');assert.equal(nav.getRouteAccess('/admin/unknown',useAuthStore.getState()),false);
});

test('action and request checks never invent a frontend permission',()=>{
 function inspect(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
   const filename=path.join(dir,entry.name);
   if(entry.isDirectory()) {inspect(filename);continue;}
   if(!/\.tsx?$/.test(filename)) continue;
   const source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true);
   function keys(node) {
    if(ts.isStringLiteral(node)) assert.ok(catalog.includes(node.text),`${filename}: ${node.text}`);
    else if(ts.isConditionalExpression(node)) {keys(node.whenTrue);keys(node.whenFalse);}
    else ts.forEachChild(node,keys);
   }
   function visit(node) {
    if(ts.isJsxAttribute(node) && ['permission','permissions'].includes(node.name.getText(source)) && node.initializer) keys(node.initializer);
    if(ts.isCallExpression(node) && /(?:\.can|\.canAll|\bloadIfAllowed)$/.test(node.expression.getText(source)) && node.arguments[0]) {
     // Conditions can contain unrelated strings; validate direct literals/lists.
     const arg=node.arguments[0];if(ts.isStringLiteral(arg)||ts.isArrayLiteralExpression(arg)) keys(arg);
    }
    ts.forEachChild(node,visit);
   }
   visit(source);
  }
 }
 inspect(path.resolve(__dirname,'../src'));
});

// Independent expected contract: existing pages keep their URLs and grants.
const routeContract = [
 ['/admin/dashboard',['dashboard.view']],
 ['/admin/inventory',['inventory.view']],
 ['/admin/inventory/materials',['inventory.view']],
 ['/admin/inventory/materials/add',['inventory.view','inventory.create']],
 ['/admin/inventory/materials/create-stock-run',['inventory.view','stockRuns.create']],
 ['/admin/inventory/materials/record-waste',['inventory.view','inventory.waste']],
 ['/admin/inventory/stock-runs',['inventory.view']],
 ['/admin/inventory/low-stock',['inventory.view']],
 ['/admin/inventory/near-expiry',['inventory.view']],
 ['/admin/inventory/waste-insights',['inventory.view']],
 ['/admin/inventory/high-value',['inventory.view']],
 ['/admin/inventory/supplier-spend',['inventory.view']],
 ['/admin/inventory/suppliers',['suppliers.view']],
 ['/admin/suppliers',['suppliers.view']],
 ['/admin/products',['products.view']],
 ['/admin/reports',['reports.view']],
 ['/admin/reports/inventory',['reports.view']],
 ['/admin/reports/pos',['reports.view']],
 ['/admin/forecasting',['forecasting.view']],
 ['/admin/alerts',['alerts.view']],
 ['/admin/users',['users.view']],
 ['/admin/roles','legacy-administrator'],
 ['/admin/recommendations','legacy-administrator'],
 ['/admin/settings','authenticated'],
 ['/staff/settings','authenticated'],
 ['/manager/settings','authenticated'],
 ['/staff/pos',['pos.view']],
 ['/staff/dashboard',['pos.view']],
 ['/staff/transactions',['pos.orders.view']],
 ['/no-access','authenticated'],
];

test('registry exactly covers protected filesystem pages without adding or changing URLs',()=>{
 const appDir=path.resolve(__dirname,'../src/app');
 const pages=[];
 function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
   const file=path.join(dir,entry.name);
   if(entry.isDirectory()) walk(file);
   else if(entry.name==='page.tsx') pages.push('/'+path.relative(appDir,dir).replaceAll('\\','/'));
  }
 }
 walk(appDir);
 const protectedPages=pages.filter(href=>!['/','/login','/forgot-password','/reset-password'].includes(href));
 const registered=routeIds.map(routeHref);
 assert.equal(new Set(registered).size,registered.length);
 assert.deepEqual([...registered].sort(),protectedPages.sort());
 assert.deepEqual([...registered].sort(),routeContract.map(([href])=>href).sort());
 for(const href of registered) assert.equal(routeHref(resolveRouteId(href)),href);
});

test('every registered page denies logged-out or missing-identity access',()=>{
 const loggedOut={isAuthenticated:false,user:{role:'ADMINISTRATOR'},can:()=>true};
 for(const [href] of routeContract) {
  assert.equal(nav.getRouteAccess(href,loggedOut),false,href);
  assert.equal(nav.getRouteAccess(href,{...loggedOut,isAuthenticated:true,user:null}),false,href);
 }
 assert.deepEqual(nav.getVisibleNavigation(loggedOut),[]);
 assert.equal(nav.getDefaultLandingRoute(loggedOut),'/no-access');
});

for(const role of ['STAFF','MANAGER','ADMINISTRATOR']) {
 test(`${role}: all registered routes preserve admission for empty, individual, action, and full grants`,()=>{
  const grantSets=[[],...catalog.map(key=>[key]),...routeContract.filter(([,p])=>Array.isArray(p)).map(([,p])=>p),catalog];
  for(const grants of grantSets) {
   signIn(grants,role);
   for(const [href,policy] of routeContract) {
    const expected=Array.isArray(policy)?policy.every(key=>grants.includes(key)):policy==='authenticated'||role==='ADMINISTRATOR';
    assert.equal(nav.getRouteAccess(href,useAuthStore.getState()),expected,`${href}: ${role} ${grants.join(',')}`);
    assert.equal(nav.getRouteAccess(href+'/',useAuthStore.getState()),expected,`${href}/`);
   }
  }
 });
}

test('unknown descendants cannot inherit a known route policy',()=>{
 signIn(catalog,'ADMINISTRATOR');
 for(const [href] of routeContract) assert.equal(nav.getRouteAccess(href+'/unregistered',useAuthStore.getState()),false,href);
 for(const href of ['/admin','/staff','/manager','/admin/inventoryish','/staff/pos-extra','/inventory','/pos','/products','/__proto__']) {
  assert.equal(nav.getRouteAccess(href,useAuthStore.getState()),false,href);
 }
});

test('non-navigation routes and aliases have independent explicit policy',()=>{
 signIn([],'ADMINISTRATOR');
 assert.equal(canAccessRoute('recommendations',useAuthStore.getState()),true);
 assert.equal(nav.adminNavigation.some(group=>group.items.some(item=>item.routeId==='recommendations')),false);
 // Removing or rearranging a menu does not revoke page access or change landing.
 signIn(['products.view']);
 const main=nav.adminNavigation[0];
 const original=main.items;
 try {
  main.items=[];
  assert.equal(nav.getRouteAccess('/admin/products',useAuthStore.getState()),true);
  assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),'/admin/products');
 } finally { main.items=original; }
});

test('landing retains every existing priority including POS before inventory',()=>{
 const ordered=[
  ['dashboard.view','/admin/dashboard'],['pos.view','/staff/pos'],
  ['inventory.view','/admin/inventory'],['products.view','/admin/products'],
  ['suppliers.view','/admin/inventory/suppliers'],['pos.orders.view','/staff/transactions'],
  ['reports.view','/admin/reports'],['forecasting.view','/admin/forecasting'],
  ['alerts.view','/admin/alerts'],['users.view','/admin/users'],
 ];
 for(let i=0;i<ordered.length;i++) {
  signIn(ordered.slice(i).map(([key])=>key));
  assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),ordered[i][1]);
 }
 signIn(['inventory.create','stockRuns.post','users.manage'],'ADMINISTRATOR');
 assert.equal(nav.getDefaultLandingRoute(useAuthStore.getState()),'/no-access');
});

test('navigation preserves groups, ordering, report children, labels and icons',()=>{
 const icons=require('lucide-react');
 const expected=[
  ['Main',[['Dashboard','/admin/dashboard','LayoutDashboard'],['Inventory','/admin/inventory','Boxes'],['Products','/admin/products','Package2'],['Suppliers','/admin/inventory/suppliers','UsersRound']]],
  ['Point of Sale',[['POS','/staff/pos','ShoppingCart'],['Transaction History','/staff/transactions','ClipboardList']]],
  ['Reports',[['Reports','/admin/reports','FileText'],['Forecasting','/admin/forecasting','TrendingUp'],['Alerts','/admin/alerts','Bell']]],
  ['Management',[['User','/admin/users','UsersRound'],['Roles & Permissions','/admin/roles','Shield'],['Settings','/admin/settings','Settings']]],
 ];
 signIn(catalog,'ADMINISTRATOR');
 const actual=nav.getVisibleNavigation(useAuthStore.getState());
 assert.deepEqual(actual.map(g=>[g.label,g.items.map(i=>[i.label,i.href])]),expected.map(([label,items])=>[label,items.map(([text,href])=>[text,href])]));
 expected.forEach(([,items],gi)=>items.forEach(([, ,icon],ii)=>assert.equal(actual[gi].items[ii].icon,icons[icon])));
 assert.deepEqual(actual[2].items[0].children.map(i=>[i.label,i.href]),[['Inventory Reports','/admin/reports/inventory'],['POS Reports','/admin/reports/pos']]);
 signIn([]);
 assert.deepEqual(nav.getVisibleNavigation(useAuthStore.getState()).map(g=>[g.label,g.items.map(i=>i.href)]),[['Management',['/admin/settings']]]);
 assert.equal(nav.matchesShellRoute('/admin/inventory/suppliers','/admin/inventory'),false);
 assert.equal(nav.matchesShellRoute('/admin/reports/pos','/admin/reports'),true);
});

test('compatibility metadata describes the existing aliases without flattening action policy',()=>{
 assert.equal(Object.keys(routeAliases).length,15);
 for(const [id,alias] of Object.entries(routeAliases)) {
  assert.ok(routes[id]);assert.ok(routes[alias.target]);assert.notEqual(id,alias.target);
  if(alias.behavior==='shared-page') assert.equal(routes[id].policy,routes[alias.target].policy);
 }
 signIn(['inventory.view']);
 assert.equal(canAccessRoute('inventory',useAuthStore.getState()),true);
 assert.equal(canAccessRoute('inventory.materials.add',useAuthStore.getState()),false);
});

test('inventory alias metadata agrees with actual existing redirects and draft encoding',async()=>{
 for(const [id,alias] of Object.entries(routeAliases)) {
  if(alias.behavior!=='redirect') continue;
  const Page=require('../src/app'+routeHref(id)+'/page.tsx').default;
  for(const draft of [undefined,'','draft /?&=+#']) {
   const query=Object.entries(alias.query).map(([key,value])=>`${key}=${encodeURIComponent(value)}`).join('&');
   const expected=routeHref(alias.target)+'?'+query+(alias.preserveQuery?.includes('draft')&&draft?'&draft='+encodeURIComponent(draft):'');
   let caught;
   try {await Page({searchParams:Promise.resolve({draft,view:'ignored',action:'ignored'})});} catch(error) {caught=error;}
   assert.deepEqual(caught,{redirect:expected},id);
  }
 }
});

test('inventory query views, actions, fallback, draft and remount key stay unchanged',async()=>{
 const InventoryPage=require('../src/app/admin/inventory/page.tsx').default;
 const views=['overview','materials','stock-runs','low-stock','near-expiry','waste','value','supplier'];
 signIn(['inventory.view']);
 for(const view of [...views,'unknown',undefined]) for(const action of ['create-material','stock-run-create','waste','invalid',undefined]) {
  const draft='draft /?&=+#';
  const element=await InventoryPage({searchParams:Promise.resolve({view,action,draft})});
  const expectedView=views.includes(view)?view:'overview';
  const expectedAction=['create-material','stock-run-create','waste'].includes(action)?action:undefined;
  assert.equal(element.props.initialView,expectedView);
  assert.equal(element.props.initialAction,expectedAction);
  assert.equal(element.props.initialDraftId,draft);
  assert.equal(element.key,`${expectedView}:${draft}:${expectedAction??''}`);
  // usePathname omits search parameters. Admission does not grant an action.
  const url=new URL('/admin/inventory?'+new URLSearchParams({view:view??'',action:action??'',draft}),'http://localhost');
  assert.equal(nav.getRouteAccess(url.pathname,useAuthStore.getState()),true);
 }
});

test('inventory and stock-run action grants remain independent of page admission',()=>{
 const operations=['inventory.create','inventory.waste','stockRuns.create','stockRuns.edit','stockRuns.delete','stockRuns.post'];
 for(const grant of operations) {
  signIn(['inventory.view',grant]);
  for(const operation of operations) {
   const html=renderToStaticMarkup(React.createElement(PermissionAction,{permission:operation},'Action'));
   assert.equal(html,grant===operation?'Action':'');
  }
 }
});

test('no-access recovery keeps self settings and excludes recursive workspace link',()=>{
 const NoAccess=require('../src/components/auth/NoAccess.tsx').default;
 signIn([]);
 assert.equal(nav.getRouteAccess('/no-access',useAuthStore.getState()),true);
 let html=renderToStaticMarkup(React.createElement(NoAccess));
 assert.match(html,/href="\/admin\/settings"/);
 assert.match(html,/Sign out/);assert.doesNotMatch(html,/Open your workspace/);
 signIn(['pos.view']);
 html=renderToStaticMarkup(React.createElement(NoAccess));
 assert.match(html,/href="\/staff\/pos"/);
});

test('existing page titles and staff presentation metadata remain distinct',()=>{
 assert.deepEqual(nav.getAdminPageInfo('/admin/dashboard'),{label:'Dashboard',subtitle:"Welcome back! Here's your inventory overview."});
 assert.deepEqual(nav.getAdminPageInfo('/admin/suppliers'),nav.getAdminPageInfo('/admin/inventory/suppliers'));
 assert.equal(nav.getAdminPageInfo('/manager/settings').label,'Account Settings');
 assert.equal(nav.getAdminPageInfo('/admin/recommendations').label,'Recommendations');
 assert.equal(nav.getAdminPageInfo('/admin/inventory/materials/add').label,'Add Raw Material');
 assert.equal(nav.getAdminPageInfo('/admin/inventory/materials'),undefined);
 assert.equal(nav.staffPageInfo['/staff/dashboard'].label,'Staff Dashboard');
 assert.equal(nav.staffPageInfo['/staff/pos'].label,'Staff POS');
 assert.equal(nav.staffPageInfo['/staff/settings'].label,'Account Settings');
});
