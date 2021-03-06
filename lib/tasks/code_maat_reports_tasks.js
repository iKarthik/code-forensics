/*
 * code-forensics
 * Copyright (C) 2016-2017 Silvio Montanari
 * Distributed under the GNU General Public License v3.0
 * see http://www.gnu.org/licenses/gpl.html
 */

var _         = require('lodash'),
    gulp      = require('gulp'),
    filter    = require('through2-filter'),
    Bluebird  = require('bluebird'),
    pp        = require('../parallel_processing'),
    logger    = require('../log').Logger,
    utils     = require('../utils'),
    appConfig = require('../runtime/app_config'),
    vcsTasks  = require('./vcs_tasks');

module.exports = function(taskDef, context, helpers) {
  var writeReport = function(analysis, reportType) {
    var stream = helpers.codeMaat[analysis](helpers.files.vcsNormalisedLog(context.dateRange))
      .pipe(filter.obj(function(obj) { return context.repository.isValidPath(obj.path); }));
    return utils.json.objectArrayToFileStream(helpers.files[reportType](), stream);
  };

  var runAnalysis = function(analysis, reportType) {
    if (helpers.codeMaat[analysis].isSupported()) {
      return pp.taskExecutor().processAll([_.partial(writeReport, analysis, reportType)]);
    }
    var vcsType = appConfig.get('versionControlSystem');
    logger.info('Codemaat: ' + reportType + ' analysis not avalable for ' + vcsType + '. Skipping...');
    return Bluebird.resolve();
  };

  var vcsFunctions = vcsTasks(taskDef, context, helpers).functions;

  var revisionsReport     = function() { return runAnalysis('revisionsAnalysis', 'revisions'); },
      effortReport        = function() { return runAnalysis('effortAnalysis', 'effort'); },
      authorsReport       = function() { return runAnalysis('authorsAnalysis', 'authors'); },
      mainDevReport       = function() { return runAnalysis('mainDevAnalysis', 'mainDeveloper'); },
      codeOwnershipReport = function() { return runAnalysis('codeOwnershipAnalysis', 'codeOwnership'); };

  return {
    functions: {
      revisionsReport:     revisionsReport,
      effortReport:        effortReport,
      authorsReport:       authorsReport,
      mainDevReport:       mainDevReport,
      codeOwnershipReport: codeOwnershipReport
    },
    tasks: function() {
      var taskInfo = { parameters: [{ name: 'dateFrom' }, { name: 'dateTo' }] };

      taskDef.addTask('revisions-report', taskInfo,
        gulp.series(vcsFunctions.vcsLogDump, revisionsReport));

      taskDef.addTask('effort-report', taskInfo,
        gulp.series(vcsFunctions.vcsLogDump, effortReport));

      taskDef.addTask('authors-report', taskInfo,
        gulp.series(vcsFunctions.vcsLogDump, authorsReport));

      taskDef.addTask('main-dev-report', taskInfo,
        gulp.series(vcsFunctions.vcsLogDump, mainDevReport));

      taskDef.addTask('code-ownership-report', taskInfo,
        gulp.series(vcsFunctions.vcsLogDump, codeOwnershipReport));
    }
  };
};
