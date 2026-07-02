import chalk from 'chalk';
import cliProgress from 'cli-progress';

export const logSuccess = (msg: string): void => console.log(chalk.green(`✓ ${msg}`));
export const logWarn = (msg: string): void => console.log(chalk.yellow(`! ${msg}`));
export const logError = (msg: string): void => console.log(chalk.red(`✗ ${msg}`));
export const logInfo = (msg: string): void => console.log(chalk.cyan(`→ ${msg}`));

export function createProgressBar(total: number): cliProgress.SingleBar {
  const bar = new cliProgress.SingleBar(
    { format: 'Scraping [{bar}] {value}/{total} | {name}' },
    cliProgress.Presets.shades_classic,
  );
  bar.start(total, 0, { name: '' });
  return bar;
}
