import Util from './util';
import Dictionary from './services/dictionary';
import '../styles/h5p-transcript.scss';

export default class Transcript extends H5P.EventDispatcher {
  /**
   * @class
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super();

    // Sanitize parameters
    this.params = Util.extend({
      mediumGroup: { medium: {} },
      transcriptFile: {},
      behaviour: {
        maxLines: 10
      },
      l10n: {
        noMedium: 'No medium was assigned to the transcript.',
        noTranscript: 'No transcript was provided.',
        troubleWebVTT: 'There seems to be something wrong with the WebVTT file. Please consult the browser\'s development console for more information.'
      },
      a11y: {
        buttonVisible: 'Hide transcript. Currently visible.',
        buttonInvisible: 'Show transcript. Currently not visible.',
        buttonAutoscrollActive: 'Turn off autoscroll. Currently active.',
        buttonAutoscrollInactive: 'Turn on autoscroll. Currently not active.',
        buttonAutoscrollDisabled: 'Autoscroll option disabled.',
        buttonInteractive: 'Switch to plaintext view',
        buttonPlaintext: 'Switch to interactive transcript view',
        buttonModeDisabled: 'Mode switching disabled.',
        buttonTimeActive: 'Hide start time. Currently shown.',
        buttonTimeInactive: 'Show start time. Currently not shown.',
        buttonTimeDisabled: 'Start time option disabled.',
        interactiveTranscript: 'Interactive transcript',
        enterToHighlight: 'Enter a query to highlight relevant text.'
      }
    }, params);

    this.contentId = contentId;
    this.extras = extras;

    // Fill dictionary
    Dictionary.fill({ l10n: this.params.l10n, a11y: this.params.a11y });

    this.previousState = extras?.previousState || {};

    const defaultLanguage = extras?.metadata?.defaultLanguage || 'en';
    this.languageTag = Util.formatLanguageCode(defaultLanguage);

    this.medium = this.buildMedium({
      medium: this.params.mediumGroup.medium,
      previousState: this.previousState.medium
    });

    this.transcript = this.buildTranscript({
      transcript: {
        library: 'H5P.TranscriptLibrary 1.0', // H5P doesn't evaluate version
        params: {
          instance: this.medium.instance,
          transcriptFile: this.params.transcriptFile,
          behaviour: {
            maxLines: this.params.behaviour.maxLines,
            buttons: ['visibility', 'plaintext', 'autoscroll']
          },
          l10n: this.params.l10n,
          a11y: this.params.a11y
        }
      },
      previousState: this.previousState.transcript
    });

    // Expect parent to set activity started when parent is shown
    if (typeof this.isRoot === 'function' && this.isRoot()) {
      this.setActivityStarted();
    }
  }

  /**
   * Attach library to wrapper.
   *
   * @param {H5P.jQuery} $wrapper Content's container.
   */
  attach($wrapper) {
    $wrapper.get(0).classList.add('h5p-transcript');
    $wrapper.get(0).appendChild(this.buildDOM());

    // Make sure DOM has been rendered with content
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.trigger('resize');
      });
    });
  }

  /**
   * Build contents including DOM and H5P instances.
   *
   * @param {object} [params={}] Parameters.
   * @param {object} params.medium Medium parameters from subcontent semantics.
   * @param {object} params.previousState Subcontent's previous state.
   * @returns {object} Contents including DOM and instance.
   */
  buildMedium(params = {}) {
    const dom = document.createElement('div');
    dom.classList.add('h5p-transcript-medium');

    // Medium specific overrides
    const machineName = params.medium?.library?.split(' ').shift();
    if (machineName === 'H5P.Audio') {
      params.medium.params.fitToWrapper = true;
      params.medium.params.playerMode = 'full';
    }
    else if (machineName === 'H5P.Video') {
      if ( // All non HTML5 handlers suffer from bad resizing if fit === true
        params.medium.params.sources?.length &&
        params.medium.params.sources[0].mime !== 'video/mp4' &&
        params.medium.params.sources[0].mime !== 'video/webm' &&
        params.medium.params.sources[0].mime !== 'video/ogg'
      ) {
        params.medium.params.visuals.fit = false;
      }

      params.medium.params.visuals.disableFullscreen = true;
    }

    const instance = (!params.medium?.library) ?
      null :
      H5P.newRunnable(
        params.medium,
        this.contentId,
        H5P.jQuery(dom),
        false,
        { previousState: params.previousState }
      );

    if (instance) {
      /*
       * Workaround for bug in H5P.Audio.
       * Chromium based browsers need explicit default height
       */
      if (machineName === 'H5P.Audio' && !!window.chrome) {
        instance.audio.style.height = '54px';
      }
      else if (machineName === 'H5P.Video') {
        // Hide fullscreen
        const videoElement = dom.querySelector('video');
        if (videoElement) {
          const controlslist = videoElement.getAttribute('controlsList');
          if (!controlslist.includes('nofullscreen')) {
            videoElement.setAttribute(
              'controlslist',
              `${controlslist} nofullscreen`
            );
          }
        }
      }
      else if (machineName === 'H5P.InteractiveVideo') {
        // Hide fullscreen
        instance.on('controls', () => {
          instance.controls?.$fullscreen?.remove();
        });
      }

      if (this.isInstanceTask(instance)) {
        instance.on('xAPI', (event) => {
          this.trackScoring(event);
        });
      }

      // Resize instance to fit inside parent and vice versa
      this.bubbleDown(this, 'resize', [instance]);
      this.bubbleUp(instance, 'resize', this);
    }
    else {
      dom.classList.add('h5p-transcript-message');
      dom.innerHTML = Dictionary.get('l10n.noMedium');
    }

    return {
      dom: dom,
      instance: instance
    };
  }

  /**
   * Build transcript including DOM and H5P instance.
   *
   * @param {object} [params={}] Parameters.
   * @param {object} params.transcript Transcript parameters.
   * @param {object} params.previousState Transcripts's previous state.
   * @returns {object} Transcript including DOM and instance.
   */
  buildTranscript(params = {}) {
    const dom = document.createElement('div');
    const instance = (!params.transcript?.library) ?
      null :
      H5P.newRunnable(
        params.transcript,
        this.contentId,
        H5P.jQuery(dom),
        false,
        { previousState: params.previousState }
      );

    if (instance) {
      // Resize instance to fit inside parent and vice versa
      this.bubbleDown(this, 'resize', [instance]);
      this.bubbleUp(instance, 'resize', this);
    }

    return {
      dom: dom,
      instance: instance
    };
  }

  /**
   * Build DOM.
   *
   * @returns {HTMLElement} Content DOM.
   */
  buildDOM() {
    const content = document.createElement('div');
    content.classList.add('h5p-transcript-content');

    content.appendChild(this.medium.dom);
    content.appendChild(this.transcript.dom);

    return content;
  }

  /**
   * Make it easy to bubble events from parent to children.
   *
   * @param {object} origin Origin of the event.
   * @param {string} eventName Name of the event.
   * @param {object[]} targets Targets to trigger event on.
   */
  bubbleDown(origin, eventName, targets = []) {
    origin.on(eventName, function (event) {
      if (origin.bubblingUpwards) {
        return; // Prevent send event back down.
      }

      targets.forEach((target) => {
        target.trigger(eventName, event);
      });
    });
  }

  /**
   * Make it easy to bubble events from child to parent.
   *
   * @param {object} origin Origin of event.
   * @param {string} eventName Name of event.
   * @param {object} target Target to trigger event on.
   */
  bubbleUp(origin, eventName, target) {
    origin.on(eventName, (event) => {

      // Prevent target from sending event back down
      target.bubblingUpwards = true;

      // Trigger event
      target.trigger(eventName, event);

      // Reset
      target.bubblingUpwards = false;
    });
  }

  /**
   * Handle timer position changed.
   *
   * @param {number} time Time in seconds.
   */
  handlePositionChanged(time) {
    if (!this.medium.instance || typeof time !== 'number') {
      return;
    }

    const machineName = this.medium.instance.libraryInfo.machineName;
    if (machineName === 'H5P.Audio') {
      this.medium.instance.audio.currentTime = time;
    }
    else if (machineName === 'H5P.InteractiveVideo') {
      this.medium.instance.video.seek(time);
    }
    else if (machineName === 'H5P.Video') {
      this.medium.instance.seek(time);
    }
  }

  /**
   * Determine whether an H5P instance is a task.
   *
   * @param {H5P.ContentType} instance Instance.
   * @returns {boolean} True, if instance is a task.
   */
  isInstanceTask(instance = {}) {
    if (!instance) {
      return false;
    }

    if (instance.isTask) {
      return instance.isTask; // Content will determine if it's task on its own
    }

    // Check for maxScore as indicator for being a task
    return (typeof instance.getMaxScore === 'function');
  }

  /**
   * Track scoring of content.
   *
   * @param {Event} event Event.
   */
  trackScoring(event) {
    if (typeof event?.getScore() !== 'number') {
      return; // Not relevant
    }

    // Ensure subcontent's xAPI statement is triggered beforehand
    window.requestAnimationFrame(() => {
      this.triggerXAPIScored(this.getScore(), this.getMaxScore(), 'completed');
    });
  }

  /**
   * Check if result has been submitted or input has been given.
   *
   * @returns {boolean} True, if answer was given.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-1}
   */
  getAnswerGiven() {
    return (this.medium?.instance?.getAnswerGiven === 'function') ?
      this.medium.instance.getAnswerGiven() :
      false;
  }

  /**
   * Get score.
   *
   * @returns {number} Score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
   */
  getScore() {
    return (this.medium?.instance?.getScore === 'function') ?
      this.medium.instance.getScore() :
      0;
  }

  /**
   * Get maximum possible score.
   *
   * @returns {number} Maximum possible score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
   */
  getMaxScore() {
    return (this.medium?.instance?.getMaxScore === 'function') ?
      this.medium.instance.getMaxScore() :
      0;
  }

  /**
   * Show solutions.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
   */
  showSolutions() {
    if (typeof this.medium.instance?.showSolutions !== 'function') {
      return;
    }

    this.medium.instance.showSolutions();
    this.trigger('resize');
  }

  /**
   * Reset task.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
   */
  resetTask() {
    if (typeof this.medium.instance?.resetTask === 'function') {
      this.medium.instance.resetTask();
    }

    this.transcript.reset();

    this.trigger('resize');
  }

  /**
   * Get xAPI data.
   *
   * @returns {object} XAPI statement.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  getXAPIData() {
    var xAPIEvent = this.createXAPIEvent('answered');

    xAPIEvent.setScoredResult(this.getScore(),
      this.getMaxScore(),
      this,
      true,
      this.getScore() === this.getMaxScore()
    );

    return {
      statement: xAPIEvent.data.statement,
      children: this.getXAPIDataFromMedium()
    };
  }

  /**
   * Get xAPI data from sub content types.
   *
   * @returns {object[]} XAPI data objects used to build report.
   */
  getXAPIDataFromMedium() {
    return (typeof this.medium.instance?.getXAPIData === 'function') ?
      this.medium.instance.getXAPIData() :
      [];
  }

  /**
   * Create an xAPI event.
   *
   * @param {string} verb Short id of the verb we want to trigger.
   * @returns {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);
    Util.extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition());

    return xAPIEvent;
  }

  /**
   * Get the xAPI definition for the xAPI object.
   *
   * @returns {object} XAPI definition.
   */
  getxAPIDefinition() {
    const definition = {};

    // TODO: Check
    // TODO: Track IV progress and emit once completed

    definition.name = {};
    definition.name[this.languageTag] = this.getTitle();
    // Fallback for h5p-php-reporting, expects en-US
    definition.name['en-US'] = definition.name[this.languageTag];
    definition.description = {};
    definition.description[this.languageTag] = Util.stripHTML(
      this.getDescription()
    );
    // Fallback for h5p-php-reporting, expects en-US
    definition.description['en-US'] = definition.description[this.languageTag];
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'compound';

    return definition;
  }

  /**
   * Get task title.
   *
   * @returns {string} Title.
   */
  getTitle() {
    // H5P Core function: createTitle
    return H5P.createTitle(
      this.extras?.metadata?.title || Transcript.DEFAULT_DESCRIPTION
    );
  }

  /**
   * Get description.
   *
   * @returns {string} Description.
   */
  getDescription() {
    return Transcript.DEFAULT_DESCRIPTION;
  }

  /**
   * Get current state.
   *
   * @returns {object} Current state.
   */
  getCurrentState() {
    return {
      medium:
        (typeof this.medium.instance?.getCurrentState === 'function') ?
          this.medium.instance.getCurrentState() :
          null,
      transcript:
        (typeof this.transcript.instance?.getCurrentState === 'function') ?
          this.transcript.instance.getCurrentState() :
          null,
    };
  }
}

/** @constant {string} */
Transcript.DEFAULT_DESCRIPTION = 'Transcript';
