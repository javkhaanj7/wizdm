import { Injectable } from '@angular/core';
import { Resolve, RouterStateSnapshot, ActivatedRouteSnapshot,Router } from '@angular/router';
import { UserProfile } from '../user/user-profile.service';
import { ContentService } from '../content/content-manager.service';
import { Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { WindowRef } from '../window/window.service';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class ResolverService implements Resolve<any> {

  constructor(private content : ContentService,
              private profile : UserProfile,
              private router  : Router,
              private window  : WindowRef) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<any> | any {

    let lang = route.params['lang'];

    // Detects the browser language on request and re-route to it
    if(lang === 'auto') {
      
      lang = this.window.detectLanguage().split('-')[0];
      console.log('Using browser language: ' + lang);

      this.router.navigate([lang || 'en']);
      return null;
    }

    // Waits to check for authentication prior to load the content to avoid flickering at startup
    return this.profile.asObservable().pipe(
      take(1),
      switchMap( profile => {

        // If authenticated, get the user preferred language
        if(!!profile && profile.lang != null && profile.lang != lang) {
          
          console.log('Switch to user language: ' + profile.lang);

          this.router.navigate([profile.lang]);
          return of(null);
        }

        // Sets the moment locale globally
        moment.locale(lang);

        // Load the localized content
        return this.content.use(lang);
      })
    );
  }
}
