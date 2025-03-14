#!/bin/bash

# AxiosDetectionStrategy.ts の修正
sed -i '' 's/sourceFile: ISourceFile | SourceFile/sourceFile: ISourceFile/g' src/detectors/http/AxiosDetectionStrategy.ts
sed -i '' 's/isKind(SyntaxKind/isKind(NodeKind/g' src/detectors/http/AxiosDetectionStrategy.ts

# SyntaxKind を NodeKind に置き換え
sed -i '' 's/chainNode.isKind(SyntaxKind.CallExpression)/chainNode.isKind(NodeKind.CallExpression)/g' src/detectors/http/AxiosDetectionStrategy.ts

echo "Script completed"
