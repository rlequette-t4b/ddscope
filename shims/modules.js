// all modules are registered globally to emulate browser

const coreModules = [
  'DDS_TOOLS',
  'DDS_COLORS',
  'DDS_DURATION',
  'DDS_STORE',
  'DDS_TRANSACTIONS',
  'DDS_TX',
  'DDS_CMD',
  'DDS_ACTIONS',
  'DDS_MODEL',
];

for (const moduleName of coreModules) {
  const moduleData = await import(`../src/core/${moduleName}.js`);
  const value = moduleData.default || moduleData[moduleName];
  console.log(`Load and declare ${moduleName}`, value);
  globalThis[moduleName] = value;
}

