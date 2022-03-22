import { Component, Input, OnInit } from '@angular/core';
import { Topic, TopicsService } from '../../../shared/services/topics.service';
import { combineLatest, Observable } from 'rxjs';
import { EnvironmentsService, KafkaEnvironment } from '../../../shared/services/environments.service';
import { DateTime } from 'luxon';
import { map, mergeMap, startWith } from 'rxjs/operators';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { ServerInfoService } from '../../../shared/services/serverinfo.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../../shared/modules/toast/toast.service';

@Component({
    selector: 'app-deprecation-component',
    templateUrl: './deprecation.component.html',
    styleUrls: ['./deprecation.component.scss']
})
export class DeprecationComponent implements OnInit {

    @Input() topic: Topic;

    @Input() isOwnerOfTopic: boolean;

    selectedEnvironment: Observable<KafkaEnvironment>;

    deprecatedDescription: string;

    eolDate: NgbDateStruct;

    deprecateTopicHtml: Observable<string>;

    minDeprecationDate: Observable<{ year: number; month: number; day: number }>;

    constructor(
        private serverInfoService: ServerInfoService,
        private translateService: TranslateService,
        private toasts: ToastService,
        private topicService: TopicsService,
        private environmentsService: EnvironmentsService
    ) {
    }

    ngOnInit() {
        // another nice Observable construct :-)
        // React on each language change to recalculate text, as locale also influences moment's text calculation.
        // As onLangChange only emits on a CHANGE of the language, we start it with the current language (I really hate that)
        const currentLang = this.translateService.onLangChange.pipe(map(evt => evt.lang))
            .pipe(startWith(this.translateService.currentLang));
        this.deprecateTopicHtml = combineLatest([currentLang, this.serverInfoService.getUiConfig()])
            .pipe(mergeMap(val => this.translateService.get('DEPRECATE_TOPIC_HTML',
                { period: this.toPeriodText(val[1].minDeprecationTime) }).pipe(map(o => o.toString()))
            ));
        this.minDeprecationDate = this.serverInfoService.getUiConfig()
            .pipe(map(config => this.getValidDatesDeprecation(config.minDeprecationTime)));

        this.selectedEnvironment = this.environmentsService.getCurrentEnvironment();
    }

    getValidDatesDeprecation(date: { years: number; months: number; days: number }) {
        const minDeprecationTime = DateTime.now().plus({ years: date.years, month: date.months, days: date.days })
            .setLocale(this.translateService.currentLang);
        return {
            year: +minDeprecationTime.toFormat('y'),
            month: +minDeprecationTime.toFormat('M'),
            day: +minDeprecationTime.toFormat('d')
        };
    }

    async handleDeprecationRequest() {
        const date = this.eolDate;
        const localDate = DateTime.local(date.year, date.month, date.day).toISODate();
        return this.topicService
            .deprecateTopic(this.deprecatedDescription, localDate, this.topic.name)
            .then(() => this.toasts.addSuccessToast('TOPIC_DEPRECATION_MARK_SUCCESS'),
                err => this.toasts.addHttpErrorToast('TOPIC_DEPRECATION_MARK_ERROR', err));
    }

    private toPeriodText(period: { years: number; months: number; days: number }): string {
        const target = DateTime.now().plus({ years: period.years, month: period.months, days: period.days });
        //const oldThreshold = DateTime.relativeTimeThreshold('d') as number;

        // special treatment: If days set, avoid moment "rounding" to months
        // Note: this still produces wrong results for some values of "days"
        // moment.js should be replaced with a better library.
        if (period.days) {
            //DateTime.relativeTimeThreshold('d', 99999);
        }

        //const result = DateTime.now().setLocale(this.translateService.currentLang).to(target, true);
        const result = target.toRelative({ base: DateTime.now().setLocale(this.translateService.currentLang) });
        //DateTime.relativeTimeThreshold('d', oldThreshold);
        return target.toRelativeCalendar();
    }
}
