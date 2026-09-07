import { Module } from '@nestjs/common';
import { ModifierValidationService } from './modifier-validation.service';
import { RecipeResolverService } from './recipe-resolver.service';

@Module({
  providers: [RecipeResolverService, ModifierValidationService],
  exports: [RecipeResolverService, ModifierValidationService],
})
export class RecipesModule {}
