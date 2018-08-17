import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { DatabaseService, QueryFn } from '../database/database.service';
import { wmUser, wmProject } from '../data-model';

import { Observable, of } from 'rxjs';
import { filter, map, tap, take, debounceTime, switchMap, mergeMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  public currentId: string = null;

  constructor(private auth: AuthService,
              private db:   DatabaseService) {
  }

  public get userId(): string { return this.auth.userId;}

  public isProjectMine(project: wmProject) : boolean {
    return typeof project.owner === 'string' ?
      project.owner === this.userId :
        project.owner.id === this.userId;
  }

  public listProjects(queryFn? : QueryFn): Observable<wmProject[]> {
    return this.db.colWithIds$<wmProject>('/projects', queryFn);
  }

  public listOwnProjects(queryFn? : QueryFn): Observable<wmProject[]> {
    return this.listProjects( ref => 
      queryFn ? queryFn( ref.where('owner', '==', this.userId) ): 
                         ref.where('owner', '==', this.userId) );
  }

  public doesProjectExists(name: string): Promise<boolean> {
    
    // Query the projects collection searching for a matching lowerCaseName
    return this.db.col$<wmProject>('projects', ref => {
        return ref.where('lowerCaseName', '==', name.trim().toLowerCase());
      } 
    ).pipe(
      debounceTime(500),
      take(1),
      map(arr => arr.length > 0),
    ).toPromise();
  }

  // Helper to format the data payload
  private formatData(data: any): any {

    // Trims the name and creates a lower case version of it for searching purposes 
    if(data.name) {
      data.name = data.name.trim();
      data['lowerCaseName'] = data.name.toLowerCase();
    }

    // Makes sure data payload always specifies the owner
    return { ...data, owner: this.userId };
  }

  public addProject(data: wmProject): Promise<void> {

    // Adds a new project
    return this.db.add<wmProject>('/projects', this.formatData(data) )
      // Updates the current id
      .then( ref => { this.currentId = ref && ref.ref && ref.ref.id;});
  }

  public updateProject(data: wmProject): Promise<void> {

    // Updates the existing project
    return this.currentId !== null ? 
      this.db.merge<wmProject>(`/projects/${this.currentId}`, this.formatData(data) ) :
        Promise.reject("currentId is null or invalid");
  }

  public queryProject(id?: string): Observable<wmProject> {

    if(id || this.currentId) {

      // Query for the project coming with the requested id
      return this.db.docWithId$<wmProject>(`/projects/${id || this.currentId}`).pipe(

        // Query for the project owner too
        mergeMap( project => 
          this.db.docWithId$<wmUser>(`/users/${project.owner}`).pipe( 
            map( owner => { return { ...project, owner } as wmProject;})
          )
        ),

        // Updates the current id
        tap( project => { this.currentId = project.id;})
      );
    }

    return of(null);
  }

  public deleteProject(id?: string): Promise<void> {
    
    // Deletes the project coming with the requested id
    return id || this.currentId ?
      this.db.delete(`/projects/${id || this.currentId}`)
        .then( () => { this.currentId = null; }) :
          Promise.reject('both id and currentId as null or invalid');
  }
}
