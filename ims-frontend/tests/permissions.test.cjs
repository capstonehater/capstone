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
 if(request==='next/navigation') return {usePathname:()=>pathname,useRouter:()=>({replace:()=>{throw new Error('Authenticated denial must not redirect');}})};
 if(request==='next/link') return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
 if(request.startsWith('@/')) request=path.resolve(__dirname,'../src',request.slice(2));
 return originalLoad.call(this,request,parent,isMain);
};
const nav=require('../src/components/layout/shell-navigation.ts');
const {default:PermissionGuard,PermissionAction}=require('../src/components/auth/PermissionGuard.tsx');
const PermissionRoute=require('../src/components/auth/PermissionRoute.tsx').default;
const {loadIfAllowed}=require('../src/lib/permission-loading.ts');
const catalog=[...fs.readFileSync(path.resolve(__dirname,'../../ims-backend/src/auth/rbac/permission-catalog.ts'),'utf8').matchAll(/key: '([^']+)'/g)].map(match=>match[1]);
function signIn(permissions,role='STAFF') {useAuthStore.getState().setAuthenticated({id:'test',name:'Test',email:'test@example.invalid',role,effectivePermissions:permissions,roles:[],authorizationRevision:'revision'});}
function featureHrefs(){return nav.getVisibleNavigation(useAuthStore.getState()).flatMap(group=>group.items).filter(item=>!item.authenticatedOnly).map(item=>item.href);}
beforeEach(()=>useAuthStore.getState().logout());

test('Administrator sees all menus with backend catalog grants',()=>{
 signIn(catalog,'ADMINISTRATOR');
 assert.deepEqual(featureHrefs(),nav.adminNavigation.flatMap(group=>group.items).filter(item=>!item.authenticatedOnly).map(item=>item.href));
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
test('navigation requirements use backend catalog keys and unknown routes deny',()=>{
 const items=nav.adminNavigation.flatMap(group=>group.items).flatMap(item=>[item,...(item.children??[])]);
 for(const item of [...items,...nav.materialActions]) if(item.permission) assert.ok(catalog.includes(item.permission),item.permission);
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
