// ref:
// - https://umijs.org/plugins/api
import { readFileSync, readdirSync, existsSync } from 'fs';
import { IApi } from '@umijs/types';
import { join } from 'path';

const joinTemplatePath = (path: string) =>
  join(__dirname, '../templates', path);

const cenerateFile = (api: IApi, fileName: string) =>
  api.onGenerateFiles(() => {
    const indexPath = `app/${fileName}`;

    const templatePath = joinTemplatePath(fileName);
    const indexTemplate = readFileSync(templatePath, 'utf-8');
    api.writeTmpFile({
      path: indexPath,
      content: api.utils.Mustache.render(indexTemplate, api.config.app),
    });
  });

export default function (api: IApi) {
  api.logger.info('use @whir/umi-plugin-app');

  api.describe({
    key: 'app',
    config: {
      default: {
        id: process.env.APPID,
      },
      schema(joi) {
        return joi.object({
          id: joi.string(),
        });
      },
    },
  });

  const files = [
    'models/auth.ts',
    'models/global.ts',
    'runtime.tsx',
    'ExtDvaContainer.tsx',
    'gql/auth.gql',
    'gql/application.gql',
    'gql/component.gql',
  ];

  files.map((fileName) => cenerateFile(api, fileName));

  api.onGenerateFiles(() => {
    const indexPath = 'app/autoImportLibrary.ts';

    const templatePath = joinTemplatePath('autoImportLibrary.ts');
    const indexTemplate = readFileSync(templatePath, 'utf-8');

    const dirs = readdirSync(api.paths.absPagesPath!, { withFileTypes: true });
    const librarys = dirs
      .filter((dir) => dir.isDirectory())
      .map((dir) => ({ path: api.paths.absPagesPath! + '/' + dir.name }));

    const layoutDir = api.paths.absSrcPath! + '/layouts';
    if (existsSync(layoutDir)) {
      librarys.push({ path: layoutDir });
    }

    api.writeTmpFile({
      path: indexPath,
      content: api.utils.Mustache.render(indexTemplate, {
        librarys,
      }),
    });
  });

  api.addRuntimePlugin({
    fn: () => join(api.paths.absTmpPath!, 'app/runtime'),
    stage: -1 * Number.MAX_SAFE_INTEGER + 1,
  });
}
