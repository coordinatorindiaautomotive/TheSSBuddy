// src/rule-engine/formula-evaluator.ts
export class FormulaEvaluator {
  /**
   * Safely evaluates a numeric math expression with variables context.
   * Example expression: "baseAmount * 0.10" or "sales * rate / 100" or "Math.max(0, sales - discount) * rate / 100"
   */
  static evaluate(expression: string, context: Record<string, any>): number {
    if (!expression || typeof expression !== 'string') return 0;

    let sanitized = expression.trim();

    // Map shorthand math function names to Math.fn
    sanitized = sanitized.replace(/\b(max|min|abs|round|floor|ceil|pow|sqrt)\b/g, 'Math.$1');

    // Sort context keys by length descending to avoid partial key replacement issues
    const sortedEntries = Object.entries(context).sort((a, b) => b[0].length - a[0].length);
    for (const [key, val] of sortedEntries) {
      if (val !== undefined && val !== null) {
        if (typeof val === 'number') {
          const regex = new RegExp(`\\b${key}\\b`, 'g');
          sanitized = sanitized.replace(regex, String(val));
        } else if (typeof val === 'string' && !isNaN(Number(val))) {
          const regex = new RegExp(`\\b${key}\\b`, 'g');
          sanitized = sanitized.replace(regex, String(Number(val)));
        } else if (typeof val === 'boolean') {
          const regex = new RegExp(`\\b${key}\\b`, 'g');
          sanitized = sanitized.replace(regex, String(val));
        }
      }
    }

    // Check for unsafe tokens
    const unsafeRegex = /\b(eval|Function|window|process|require|import|global|this|constructor|prototype|__proto__)\b|[;{}[\]?:=<>]/;
    if (unsafeRegex.test(sanitized)) {
      throw new Error(`Formula contains invalid or unsafe tokens: "${expression}"`);
    }

    // Allow digits, decimals, whitespace, basic math operators (+, -, *, /, %, (, ), ,), and Math.method calls
    const validMathPattern = /^(?:[0-9\s\.\+\-\*\/\%\(\),]|Math\.(?:max|min|abs|round|floor|ceil|pow|sqrt))+$/;
    if (!validMathPattern.test(sanitized)) {
      throw new Error(`Formula contains unauthorized symbols after substitution: "${sanitized}"`);
    }

    try {
      const fn = new Function(`return (${sanitized});`);
      const result = fn();
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (err: any) {
      throw new Error(`Failed to evaluate formula "${expression}": ${err.message}`);
    }
  }

  /**
   * Evaluates a rule condition operator against context values.
   */
  static evaluateCondition(
    contextValue: any,
    operator: string,
    targetValue?: string | null,
    targetValue2?: string | null,
  ): boolean {
    if (operator === 'IS_NULL') return contextValue === null || contextValue === undefined || contextValue === '';
    if (operator === 'IS_NOT_NULL') return contextValue !== null && contextValue !== undefined && contextValue !== '';

    if (contextValue === null || contextValue === undefined) return false;

    const strContext = String(contextValue).trim();
    const strTarget = targetValue !== null && targetValue !== undefined ? String(targetValue).trim() : '';

    const numContext = parseFloat(strContext);
    const numTarget = parseFloat(strTarget);
    const isNumeric = !isNaN(numContext) && !isNaN(numTarget) && /^[\d\.\-]+$/.test(strContext);

    switch (operator) {
      case 'EQ':
        return isNumeric ? numContext === numTarget : strContext.toUpperCase() === strTarget.toUpperCase();
      case 'NEQ':
        return isNumeric ? numContext !== numTarget : strContext.toUpperCase() !== strTarget.toUpperCase();
      case 'GT':
        return isNumeric ? numContext > numTarget : false;
      case 'GTE':
        return isNumeric ? numContext >= numTarget : false;
      case 'LT':
        return isNumeric ? numContext < numTarget : false;
      case 'LTE':
        return isNumeric ? numContext <= numTarget : false;
      case 'IN': {
        const list = strTarget.split(',').map((s) => s.trim().toUpperCase());
        return list.includes(strContext.toUpperCase());
      }
      case 'NOT_IN': {
        const list = strTarget.split(',').map((s) => s.trim().toUpperCase());
        return !list.includes(strContext.toUpperCase());
      }
      case 'BETWEEN': {
        const numTarget2 = targetValue2 ? parseFloat(targetValue2) : NaN;
        if (!isNumeric || isNaN(numTarget2)) return false;
        return numContext >= numTarget && numContext <= numTarget2;
      }
      case 'LIKE': {
        const pattern = new RegExp(strTarget.replace(/%/g, '.*'), 'i');
        return pattern.test(strContext);
      }
      default:
        return false;
    }
  }
}
