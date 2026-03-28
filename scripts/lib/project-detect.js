/**
 * Salesforce project type and framework detection
 *
 * Cross-platform (Windows, macOS, Linux) project type detection
 * by inspecting files in the working directory. Tailored for Salesforce
 * projects with support for common web technologies used alongside SF.
 */

const fs = require('fs');
const path = require('path');

/**
 * Salesforce project detection rules.
 * Each rule checks for marker files specific to Salesforce project types.
 */
const SF_PROJECT_RULES = [
  {
    type: 'sfdx',
    markers: ['sfdx-project.json', 'sf-project.json'],
    description: 'Salesforce DX Project'
  },
  {
    type: 'lwc',
    markers: ['force-app/main/default/lwc'],
    description: 'Lightning Web Components'
  },
  {
    type: 'apex',
    markers: ['force-app/main/default/classes'],
    description: 'Apex Classes'
  },
  {
    type: 'aura',
    markers: ['force-app/main/default/aura'],
    description: 'Aura Components (Legacy)'
  },
  {
    type: 'flow',
    markers: ['force-app/main/default/flows'],
    description: 'Salesforce Flows'
  },
  {
    type: 'trigger',
    markers: ['force-app/main/default/triggers'],
    description: 'Apex Triggers'
  }
];

/**
 * Language detection rules for non-Salesforce languages.
 */
const LANGUAGE_RULES = [
  {
    type: 'typescript',
    markers: ['tsconfig.json', 'tsconfig.build.json'],
    extensions: ['.ts', '.tsx']
  },
  {
    type: 'javascript',
    markers: ['package.json', 'jsconfig.json'],
    extensions: ['.js', '.jsx', '.mjs']
  },
  {
    type: 'java',
    markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    extensions: ['.java']
  },
  {
    type: 'python',
    markers: ['requirements.txt', 'pyproject.toml', 'setup.py'],
    extensions: ['.py']
  }
];

/**
 * Framework detection rules relevant to Salesforce ecosystems.
 */
const FRAMEWORK_RULES = [
  // Salesforce frameworks
  { framework: 'fflib', language: 'apex', markers: [], packageKeys: ['fflib'] },

  // JavaScript/TypeScript frameworks (for LWC/Heroku)
  { framework: 'react', language: 'typescript', markers: [], packageKeys: ['react'] },
  { framework: 'express', language: 'javascript', markers: [], packageKeys: ['express'] },
  { framework: 'nextjs', language: 'typescript', markers: ['next.config.js', 'next.config.mjs', 'next.config.ts'], packageKeys: ['next'] },

  // Java frameworks (for SF Java SDK)
  { framework: 'spring', language: 'java', markers: [], packageKeys: ['spring-boot', 'org.springframework'] }
];

/**
 * Check if a file or directory exists relative to the project directory
 */
function fileExists(projectDir, filePath) {
  try {
    return fs.existsSync(path.join(projectDir, filePath));
  } catch {
    return false;
  }
}

/**
 * Check if any file with given extension exists in the project root
 */
function hasFileWithExtension(projectDir, extensions) {
  try {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    return entries.some(entry => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name);
      return extensions.includes(ext);
    });
  } catch {
    return false;
  }
}

/**
 * Read and parse package.json dependencies
 */
function getPackageJsonDeps(projectDir) {
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return [];
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
  } catch {
    return [];
  }
}

/**
 * Read sfdx-project.json for Salesforce project configuration
 */
function getSfdxProjectConfig(projectDir) {
  try {
    const sfdxPath = path.join(projectDir, 'sfdx-project.json');
    if (!fs.existsSync(sfdxPath)) {
      const sfPath = path.join(projectDir, 'sf-project.json');
      if (!fs.existsSync(sfPath)) return null;
      return JSON.parse(fs.readFileSync(sfPath, 'utf8'));
    }
    return JSON.parse(fs.readFileSync(sfdxPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Detect Salesforce project type, languages, and frameworks
 * @param {string} [projectDir] - Project directory (defaults to cwd)
 * @returns {{ sfTypes: string[], languages: string[], frameworks: string[], primary: string, projectDir: string, sfdxConfig: Object|null }}
 */
function detectProjectType(projectDir) {
  projectDir = projectDir || process.cwd();
  const sfTypes = [];
  const languages = [];
  const frameworks = [];

  // Step 1: Detect Salesforce project types
  for (const rule of SF_PROJECT_RULES) {
    const hasMarker = rule.markers.some(m => fileExists(projectDir, m));
    if (hasMarker) {
      sfTypes.push(rule.type);
    }
  }

  // Step 2: Detect additional languages
  for (const rule of LANGUAGE_RULES) {
    const hasMarker = rule.markers.some(m => fileExists(projectDir, m));
    const hasExt = rule.extensions.length > 0 && hasFileWithExtension(projectDir, rule.extensions);
    if (hasMarker || hasExt) {
      languages.push(rule.type);
    }
  }

  // Deduplicate: if both typescript and javascript detected, keep typescript
  if (languages.includes('typescript') && languages.includes('javascript')) {
    const idx = languages.indexOf('javascript');
    if (idx !== -1) languages.splice(idx, 1);
  }

  // Step 3: Detect frameworks
  const npmDeps = getPackageJsonDeps(projectDir);

  for (const rule of FRAMEWORK_RULES) {
    const hasMarker = rule.markers.some(m => fileExists(projectDir, m));
    let hasDep = false;
    if (rule.packageKeys.length > 0 && (rule.language === 'typescript' || rule.language === 'javascript')) {
      hasDep = rule.packageKeys.some(key => npmDeps.some(dep => dep.toLowerCase().includes(key.toLowerCase())));
    }
    if (hasMarker || hasDep) {
      frameworks.push(rule.framework);
    }
  }

  // Step 4: Determine primary type
  let primary = 'unknown';
  if (sfTypes.length > 0) {
    primary = 'salesforce';
  } else if (frameworks.length > 0) {
    primary = frameworks[0];
  } else if (languages.length > 0) {
    primary = languages[0];
  }

  // Step 5: Read SFDX project config
  const sfdxConfig = getSfdxProjectConfig(projectDir);

  return {
    sfTypes,
    languages,
    frameworks,
    primary,
    projectDir,
    sfdxConfig
  };
}

module.exports = {
  detectProjectType,
  SF_PROJECT_RULES,
  LANGUAGE_RULES,
  FRAMEWORK_RULES,
  // Exported for testing
  getPackageJsonDeps,
  getSfdxProjectConfig
};
