const fs = require('fs');
const file = 'src/components/onboarding/ForgeDemo.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import React, \{.*?\} from 'react';/, "import React, { useRef, useEffect, useCallback, useState } from 'react';");
content = content.replace("import { forgeWebViewHtml } from './forgeWebViewHtml';", "import { Asset } from 'expo-asset';\nimport * as FileSystem from 'expo-file-system/legacy';\nimport { forgeWebViewHtml } from './forgeWebViewHtml';");

const originalHook = /const imageUri = useMemo\([\s\S]*?\[\]\s*\n\s*\);/;
const newHook = `const [resolvedImageUri, setResolvedImageUri] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadAsset() {
      try {
        const asset = Asset.fromModule(forgeRevealAsset);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        if (isCancelled) return;

        const uri = asset.localUri || asset.uri;
        if (uri.startsWith('file:') || uri.startsWith('content:')) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setResolvedImageUri(\`data:image/png;base64,\${base64}\`);
        } else {
          setResolvedImageUri(uri);
        }
      } catch (err) {
        if (!isCancelled) {
          setResolvedImageUri(RNImage.resolveAssetSource(forgeRevealAsset).uri);
        }
      }
    }
    loadAsset();
    return () => {
      isCancelled = true;
    };
  }, []);`;
content = content.replace(originalHook, newHook);

const origInject = /const injectImageUri = useCallback\(\(\) => \{[\s\S]*?\}, \s*\[imageUri\]\);/;
const newInject = `const injectImageUri = useCallback(() => {
    if (!resolvedImageUri) return;
    webViewRef.current?.injectJavaScript(\`
      (function() {
        var img = document.getElementById('forgeSigil');
        if (img) img.src = \${JSON.stringify(resolvedImageUri)};
      })();
      true;
    \`);
  }, [resolvedImageUri]);

  useEffect(() => {
    if (resolvedImageUri) {
      injectImageUri();
    }
  }, [resolvedImageUri, injectImageUri]);`;
content = content.replace(origInject, newInject);

const origProps = /originWhitelist=\{.*?\}.*?mixedContentMode="never"/s;
const newProps = `originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"`;
content = content.replace(origProps, newProps);

fs.writeFileSync(file, content);
console.log('done');
