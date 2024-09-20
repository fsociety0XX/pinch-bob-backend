import path from 'path';
import moduleAlias from 'module-alias';
import { DEVELOPMENT } from './constants/static';

// Setup aliases based on the environment
if (process.env.NODE_ENV === DEVELOPMENT) {
  moduleAlias.addAliases({
    '@src': path.resolve(__dirname),
  });
} else {
  moduleAlias.addAliases({
    '@src': path.resolve(__dirname, '../dist'),
  });
}
