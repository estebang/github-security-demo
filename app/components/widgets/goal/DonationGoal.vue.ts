import { Component } from 'vue-property-decorator';
import GenericGoal from './GenericGoal.vue';
import Vue from 'vue';

@Component({
  components: {
    GenericGoal,
  },
})
export default class Goal extends Vue {}
