import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { ExamplesPageComponent } from './pages/examples-page/examples-page.component';
import { TheoryPageComponent } from './pages/theory-page/theory-page.component';

export const routes: Routes = [
    { path: '', title: "Почетна", component: HomePageComponent},
    { path: 'primeri', title: "Примери", component: ExamplesPageComponent },
    { path: 'teorija', title: "Теорија", component: TheoryPageComponent },
    { path: '**', redirectTo: '' }
];
